// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useDatasetDimensionLabels — the analytics label net for dataset-bound
 * REPORTS (objectui#4330).
 *
 * ## What this is
 *
 * The `{dimension → {value|authoredLabel → displayLabel}}` map every surface in
 * `DatasetReportRenderer` relabels its rows through. It is the SAME channel the
 * dashboard's `DatasetWidget` uses, not a report-side dialect — the resolution
 * walk, the option localization and the map construction are all the shared
 * `@object-ui/core` helpers PR #4324 landed:
 *
 *   `resolveDimensionFieldMeta` → `localizeFieldOptions` / `buildDimensionLabelMap`
 *   → `relabelDimensions` (applied by the caller)
 *
 * and the translator is `useSafeFieldLabel().fieldOptionLabel`, i.e.
 * `{ns}.fieldOptions.<object>.<field>.<value>` — the one convention list and
 * form surfaces already translate select options through. Nothing here decides
 * what a label IS; it only carries the object metadata to the helpers that do.
 *
 * ## Why a report-local hook rather than a shared one
 *
 * The natural home for this glue is `@object-ui/core`, beside the helpers it
 * calls. It is here instead because `packages/core` is held by another task in
 * flight (objectui#4040 tranche 5) and this card's surface is the two plugin
 * packages. The DUPLICATION is the fetch-and-memo wiring only — roughly the
 * shape `DatasetWidget`'s effect has — and never the resolution rules. Lifting
 * it into core once tranche 5 lands is filed as a follow-up.
 *
 * ## Why the read is issued at all (the #4263 boundary, amended by #4330)
 *
 * A dataset report renders SERVER-RESOLVED rows (ADR-0021: a local select
 * dimension arrives carrying the object's AUTHORED English option label) and
 * used to load no object metadata whatever, which is exactly why PR #4324
 * carried no change to this package. With no option list on the client there is
 * nothing for the locale bundle to translate against, so a zh-CN report read
 * `Domestic` beside a related list reading 国内. The read is what closes that.
 *
 * It is not gated on "the dimension is a select", because select-ness is not
 * observable before the read: the spec's `DatasetDimension.type` enum is
 * `string|number|date|boolean|lookup` (no `select` member), and a select column
 * arrives on the wire typed `'string'`. The gate lands on the read's OUTPUT
 * instead, where it is exact — `resolveDimensionFieldMeta` returns an entry
 * only for a terminal field that actually carries `options`, so a
 * text/number/date/lookup dimension yields no map and `relabelDimensions`
 * returns the caller's rows by identity.
 */

import * as React from 'react';
import {
  buildDimensionLabelMap,
  resolveDimensionFieldMeta,
  type DimensionFieldMeta,
  type OptionLabelTranslator,
} from '@object-ui/core';
import { SchemaRendererContext } from '@object-ui/react';
import { useSafeFieldLabel } from '@object-ui/i18n';

/** `{ dimension → { rowValue → displayLabel } }`, or null when nothing resolved. */
export type DimensionLabelMaps = Record<string, Record<string, string>> | null;

/**
 * Resolve the label maps for one dataset query's dimensions.
 *
 * @param object the dataset's base object, as the query result reported it
 * @param dimensionFields the result's `dimension → field path` map (a dotted
 *   path resolves against the relationship TARGET, ADR-0071 multi-hop included)
 * @param dimensions the dimension names this surface renders
 */
export function useDatasetDimensionLabels(
  object: string | undefined,
  dimensionFields: Record<string, string> | undefined,
  dimensions: string[],
): DimensionLabelMaps {
  const { fieldOptionLabel } = useSafeFieldLabel();
  // The host's AUTHENTICATED fetch (objectui#4121) — the same channel the
  // dashboard widget's identical read rides, falling back to the global one
  // when no host supplies it. Read directly off the context rather than through
  // a `useSchemaContext()` that throws, so a report rendered outside a host
  // (every existing suite in this package) keeps degrading instead of crashing.
  const apiFetch = React.useContext(SchemaRendererContext)?.apiFetch;

  // Kept LOCALE-FREE in state, exactly as `DatasetWidget` keeps it (#4030):
  // the bundle is applied in the memo below, so switching language re-labels in
  // place instead of re-fetching the schema.
  const [optionMeta, setOptionMeta] = React.useState<{
    metaByPath: Record<string, DimensionFieldMeta>;
    relabel: Array<{ dim: string; path: string }>;
  } | null>(null);

  // A string signature, for the same reason `useDatasetRows` uses one: `rows` /
  // `columns` reach this renderer as arrays rebuilt on every render, so keying
  // the effect on their identity would refetch forever.
  const dims = dimensions.filter(Boolean);
  const signature = `${object ?? ''}|${dims.join(',')}|${JSON.stringify(dimensionFields ?? null)}`;

  React.useEffect(() => {
    if (!object || dims.length === 0) {
      setOptionMeta(null);
      return;
    }
    const fieldOf = (dim: string) => (dimensionFields && dimensionFields[dim]) || dim;
    let cancelled = false;
    (async () => {
      try {
        const doFetch = apiFetch ?? fetch;
        const loadObjectSchema = async (name: string) => {
          const r = await doFetch(`/api/v1/meta/object/${encodeURIComponent(name)}`, {
            headers: { accept: 'application/json' },
            credentials: 'include',
          });
          const doc = await r.json().catch(() => null);
          return doc?.item ?? doc?.data ?? doc;
        };
        const objSchema = await loadObjectSchema(object);
        // ONE walk for every dimension, memoized per call — sibling dimensions
        // sharing a relationship prefix fetch that object once.
        const metaByPath = await resolveDimensionFieldMeta(
          objSchema,
          dims.map(fieldOf),
          loadObjectSchema,
        );
        if (!cancelled) {
          setOptionMeta({ metaByPath, relabel: dims.map((dim) => ({ dim, path: fieldOf(dim) })) });
        }
      } catch {
        // Best-effort by construction: a failed read leaves the rows exactly as
        // the server sent them, which is what this surface rendered before.
        if (!cancelled) setOptionMeta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, apiFetch]);

  return React.useMemo(() => {
    if (!optionMeta) return null;
    const { metaByPath, relabel } = optionMeta;
    // One translator per resolved path, bound to the object that OWNS the
    // terminal field — the relationship TARGET for a dotted path, not the
    // dataset's base object, because that is the object the bundle key names.
    const translatorFor = (path: string): OptionLabelTranslator | undefined => {
      const meta = metaByPath[path];
      const owner = meta?.object;
      if (!owner) return undefined;
      return (value, authored) => fieldOptionLabel(owner, meta.field, value, authored);
    };
    const labels: Record<string, Record<string, string>> = {};
    for (const { dim, path } of relabel) {
      const m = buildDimensionLabelMap(metaByPath[path]?.options, translatorFor(path));
      if (m) labels[dim] = m;
    }
    return Object.keys(labels).length > 0 ? labels : null;
  }, [optionMeta, fieldOptionLabel]);
}
