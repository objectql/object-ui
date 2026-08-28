/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useDataScope, SchemaRendererContext, SchemaRenderer, useFilterScope } from '@object-ui/react';
import {
  extractRecords,
  isDrillEnabled,
  columnIdentity,
  columnHeader,
} from '@object-ui/core';
import type { DrillDownConfig, TableColumn } from '@object-ui/types';
import { normalizeTableColumnType } from '@object-ui/types';
import { Skeleton, RefreshIndicator, cn } from '@object-ui/components';
import { useSafeFieldLabel, useObjectTranslation, useLocalization, useDisplayLocale } from '@object-ui/i18n';
import { resolveFilterPlaceholders, humanizeFieldKey } from './utils';
import type { FieldMeta } from './recordFields';
import {
  buildFieldMeta,
  renderFieldValue,
  isNumericFieldMeta,
  isSystemField,
  // The package's single relation predicate (objectui#5876). The retirement
  // gate and the family read live in ITS body — never restated here.
  isLookupType,
} from './recordFields';
import { RecordDetailDrawer } from './RecordDetailDrawer';

export interface ObjectDataTableProps {
  schema: {
    type: string;
    objectName?: string;
    dataProvider?: { provider: string; object?: string };
    bind?: string;
    filter?: any;
    data?: any[];
    columns?: any[];
    searchable?: boolean;
    pagination?: boolean;
    className?: string;
    [key: string]: any;
  };
  dataSource?: any;
  className?: string;
}

/** A column definition after normalization, with header and accessor key. */
interface NormalizedColumn {
  header: string;
  accessorKey: string;
  [key: string]: any;
}

/**
 * What this widget's column producer is allowed to EMIT (objectui#6373).
 *
 * `enrich` below hands its result to `data-table`, whose columns slot is
 * `DataTableSchema.columns: TableColumn[]`. It used to return
 * `NormalizedColumn`, whose `[key: string]: any` accepts anything, so nothing
 * checked the emit against the slot's declaration at all: `{ ...col,
 * ...fieldMeta }` wrote SEVEN keys `TableColumn` does not declare — `name`,
 * `label`, `options`, `referenceTo`, `format`, `currency`, `decimals`.
 *
 * ## ⭐ Why this is not just `: TableColumn`
 *
 * Measured on this program before choosing the shape: annotating the return
 * `TableColumn` and leaving the spread in place raises NO error. TypeScript's
 * excess-property check is a FRESHNESS check on the properties an object
 * literal WRITES OUT; properties arriving through a spread are exempt. So the
 * plain annotation the card suggested is blind to the exact defect the card is
 * about — it would have type-checked the seam without enforcing it, converting
 * a surfaced-key census into a silenced one.
 *
 * The `?: never` members are what make the annotation able to fail. They are
 * ADR-0049 retirement tombstones — this repo's convention for a key that is
 * refused rather than merely absent (`StaticTableColumn` in
 * `@object-ui/types`, `crud.ts` `confirm`) — and they bite by ASSIGNABILITY,
 * not freshness: `FieldMeta['label']` is `string`, which is not assignable to
 * `undefined`, so re-introducing `{ ...fieldMeta }` here is a compile error
 * (TS2322) naming the first offending key. Writing one out explicitly is the
 * other error (TS2353). Both directions were run before this type was written.
 *
 * ## The rule, so the next producer gets the same answer
 *
 * A producer may write into a `TableColumn[]` slot only keys the CONSUMER of
 * that slot reads, and the consumer's read set is MEASURED from the consumer's
 * source, never assumed. Then: a key the consumer reads and `TableColumn`
 * declares is written; a key the consumer reads and `TableColumn` does not
 * declare is held as an alias only where a ruling already holds it; a key the
 * consumer does not read is RETIRED from the emit — never declared, because
 * declaring a key nothing reads is the same `declared != enforced` defect
 * facing the other way (objectui#5453's forwarded `wrap` key).
 *
 * Measured read set of the consumer (`data-table.tsx`, comments stripped):
 * `accessorKey`, `width`, `align`, `header`, `className`, `cellClassName`,
 * `sortable`, `resizable`, `editable`, `type`, `cell`, `headerIcon`,
 * `fitContent`, and `name`. Not one of `label`, `options`, `referenceTo`,
 * `format`, `currency`, `decimals` appears — so all six retired from the
 * emit, and this producer still SOURCES none of them from `fieldMeta`.
 *
 * ⚠️ Three of the six — `format`, `options`, `currency` — have since been
 * DECLARED on `TableColumn` itself (objectui#6425, maintainer ruling
 * 2026-08-27), so they are no longer tombstoned on this emit type: the band
 * below derives them away the moment the declaration landed. That is not a
 * softening of the emit rule but its other branch — an AUTHORED value now
 * passes through `{ ...col }` as declared metadata (the cell pipeline reads
 * it back off the authored column), while writing one out of `fieldMeta`
 * remains retired, pinned by the runtime census in
 * `ObjectDataTable.emitBoundary-6373.test.tsx`.
 *
 * Retiring them is behaviour-preserving because none of them was the live path
 * for its own value: everything they carried is read off `fieldMeta` by the
 * `cell` closure below, which is where this widget's type-aware rendering
 * actually happens. That check — does the value still reach its consumer by
 * another road? — is part of the rule, not an aside: a key with no second road
 * is not inert, and retiring it would change behaviour.
 *
 * `type` is not adjudicated here. objectui#5853 already settled it at this
 * seam, and its fold (`normalizeTableColumnType`) stands unchanged.
 *
 * `name` is HELD, not retired, and not adjudicated here either: it is
 * objectui#5120's, still open. `data-table` reads `col.accessorKey || col.name`
 * and holds that alias deliberately, because two PUBLISHED skill guides teach a
 * `data-table` column spelled `{ name, label }`. So this producer keeps writing
 * it, byte for byte what it wrote before, and the hold is now DECLARED at the
 * seam instead of arriving anonymously inside a spread. When #5120 retires the
 * consumer alias, this member becomes a tombstone with it.
 */
/**
 * ⭐ `decimals` — RETIRED from `FieldMeta` ITSELF (objectui#6625), and this
 * hand-written tombstone is now the ONLY enforcement of that key's refusal at
 * BOTH halves of this seam. ⛔ Do not "tidy" it away as redundant.
 *
 * Until objectui#6625 the key needed no tombstone: it was a `FieldMeta` member,
 * so BOTH bands below — {@link EnrichedColumn}'s write-side tombstones
 * (objectui#6373) and {@link UnheldFieldMetaOverrideKey}'s read-side refusal
 * (objectui#6425) — derived it for free. Refusal by MEMBERSHIP. #6625 then
 * retired the member (written from the schema def, read by nothing), which
 * removed it from `keyof FieldMeta` and silently ended that enforcement at both
 * ends. Nothing would have gone red at the moment of loss: on the read side the
 * suite's `@ts-expect-error` would merely have turned TS2578-unused, and on the
 * write side the hand-written pin would have gone on passing on the
 * excess-property check alone — a pin passing because its subject stopped
 * existing.
 *
 * This is the exact mirror of the rule `ObjectGrid`'s sibling tombstone
 * records (`ObjectGridRetiredOptionsTombstone`, objectui#6425): *a pin enforced
 * by a key's non-membership silently stops enforcing the moment the key becomes
 * a member.* Read from this end: **a refusal DERIVED from a key's membership
 * silently stops enforcing the moment that member is deleted.** Same seam, same
 * blindness, opposite direction — which is why the retirement had to be
 * re-stated by hand rather than inherited.
 *
 * objectui#6425's verdict is unchanged — no reader for an authored `decimals`
 * existed then and none exists now — and so is the runtime behaviour: the value
 * the retired `buildFieldMeta` write resolved reached nothing. Only the
 * refusal's mechanism moves, from derived to hand-written. It is intersected
 * into BOTH types below, because the retirement belongs to the SEAM, not to one
 * of its two halves — the same reason `ObjectGrid` intersects its own tombstone
 * into both its draft and its post-fold column. ⭐ A future reader for decimal
 * places reads `scale`, never this key (objectui#6625; `NumberCellRenderer`
 * already does).
 */
type ObjectDataTableRetiredDecimalsTombstone = { decimals?: never };

export type EnrichedColumn =
  TableColumn
  /** HELD alias, objectui#5120 — see above. Not declared by `TableColumn`. */
  & { name?: string }
  /** RETIRED at this emit seam, objectui#6373 — derived, never hand-listed, so
   *  a future `FieldMeta` member is tombstoned by default and has to be
   *  adjudicated to escape. */
  & { [K in Exclude<keyof FieldMeta, keyof TableColumn | 'name'>]?: never }
  & ObjectDataTableRetiredDecimalsTombstone;

/**
 * What this widget's column producer is allowed to READ off the AUTHORED
 * column as a field-meta override (objectui#6425) — the READ half of the seam
 * {@link EnrichedColumn} above fences on the WRITE side. objectui#6373 fenced
 * what `enrich` emits; nothing yet fenced what it consumes.
 *
 * `enrich` handed `buildFieldMeta` six values taken off the authored column.
 * Five of them — `format`, `options`, `referenceTo`, `currency`, `decimals` —
 * were declared by neither `TableColumn` (`@object-ui/types`) nor its
 * `TableColumnSchema` zod mirror. Three were reached through `(col as any)`;
 * the other two through {@link NormalizedColumn}'s `[key: string]: any`, which
 * answers `any` just as loudly without the tell. So the widget honoured an
 * authoring vocabulary the published types refuse, and no artefact in the repo
 * said which keys those were or why.
 *
 * ## The per-key ruling landed (objectui#6425, maintainer 2026-08-27)
 *
 * This type used to hold all five keys with ⛔ "declares nothing and retires
 * nothing" — both branches were maintainer decisions. The ruling has since
 * disposed of them per key, and this keyhole now CARRIES that disposition:
 *
 *  - `format`, `options` — DECLARED on `TableColumn` + its zod mirror
 *    (documented AND kept; declaring is truth-maintenance). Read below at
 *    their published types via `Pick<TableColumn, …>`.
 *  - `currency` — DECLARED (kept in production, never promised before;
 *    declaring makes the existing behaviour honest). Same `Pick`.
 *  - `decimals` — RETIRED, immediately (neither promised nor kept: zero
 *    readers measured, and the authored read below is gone). Refused by
 *    {@link ObjectDataTableRetiredDecimalsTombstone} since objectui#6625
 *    retired the `FieldMeta` member itself and took the key out of the derived
 *    band's pool; the verdict is unchanged, only its mechanism moved.
 *  - `referenceTo` — ⛔ NOT declared as spelled; still HELD, owned by
 *    objectui#6597 (the enforce-or-remove channel: fix the spelling chain so
 *    the promise becomes real, or withdraw the README line).
 *
 * The shape itself is unchanged from what objectui#6461 landed for
 * `plugin-grid` (`ObjectGridColumnHolds` / `RetiredListColumnKey`); the
 * identifiers differ because this producer's seam is a READ, not an emit.
 *
 * ## The band is DERIVED, and it bites by assignability
 *
 * `FieldMeta` is the override vocabulary — `buildFieldMeta`'s `overrides` is a
 * subset of it — so it is the pool a new tolerance would come from, and the
 * same pool {@link EnrichedColumn}'s tombstones derive from. Deriving means a
 * NEW `FieldMeta` member is refused here on the day it is added, without
 * anyone remembering to extend a hand-written list. (Stated without a count on
 * purpose: it read "a seventh" while the type had eight members, and
 * objectui#6625 has since retired one. The property is that ADDING is covered
 * by derivation — ⚠️ REMOVING is not, which is why that card had to leave
 * {@link ObjectDataTableRetiredDecimalsTombstone} behind by hand.)
 *
 * ⚠️ It derives from the OVERRIDE VOCABULARY, not from the authored input
 * type, and that difference is forced rather than stylistic. `plugin-grid`'s
 * sibling band (`RetiredListColumnKey`, objectui#6461) is
 * `Exclude<keyof ListColumn, …>` — it can derive from its authored type
 * because `ListColumn` DECLARES its keys. This producer's authored type
 * cannot: {@link NormalizedColumn} carries `[key: string]: any`, so `keyof` it
 * is `string | number`. Measured on this program — a band built on it accepts
 * `'totallyMadeUpKey'` as a member, so it would ban nothing at all. The pool
 * therefore has to be the vocabulary the overrides are drawn FROM.
 *
 * That choice has a cost, and it is stated here rather than left to be
 * discovered: a candidate key OUTSIDE `FieldMeta` can never land in the band.
 * It is refused by the other half of this type instead —
 * `AuthoredColumnOverrides` declares no index signature, so reading an
 * unadjudicated key is TS2339 AT THE READ SITE, which is the enforcement
 * `enrich` actually runs on (`(col as any).x` and the bag's index signature
 * both answered `any` there). Both halves are pinned by the suite.
 *
 * ⚠️ Measured on this program, in both directions, before this shape was
 * written:
 *  - `?: never` bites by ASSIGNABILITY, not by freshness, so the refusal
 *    survives a spread — `const s: AuthoredColumnOverrides = someBag` fails on
 *    a source that DECLARES a banded key, and passes on one that does not.
 *  - `accessorKey` is required here for a reason that is not decoration:
 *    without one property in common, TypeScript's weak-type check rejects the
 *    assignment below outright (TS2559), and a type that refuses everything
 *    pins nothing. It is the same key {@link NormalizedColumn} already
 *    declares required, so this makes no new claim about the authored object.
 *
 * ## A VIEW, not a census of the object
 *
 * The banded members say "this producer must not SOURCE this override from the
 * authored column" — not "this key is absent at run time". `normalizeColumns`
 * deliberately leaves the authored spelling in place, so a column really can
 * carry `name` / `label`; they are refused HERE because this seam already has
 * answers for both and they do not come from the column: `name` comes from
 * `accessorKey` and `label` from `col.header`, which objectui#5351 made the one
 * place the authored label is translated.
 */

/**
 * The undeclared-but-live override keys this producer still holds. One is
 * left: objectui#6425's ruling (maintainer, 2026-08-27) declared `format` /
 * `options` / `currency` on `TableColumn` itself (they are read via
 * `Pick<TableColumn, …>` below, no hold needed) and retired `decimals`
 * outright — refused by {@link ObjectDataTableRetiredDecimalsTombstone} since
 * objectui#6625 retired the `FieldMeta` member that used to carry it into the
 * derived band.
 */
export interface ObjectDataTableColumnHolds {
  /**
   * HELD — owned by objectui#6597, where objectui#6425's ruling routed it
   * (⛔ NOT declared as spelled). Named as an author override by the package
   * README but MEASURED with no reader on this path: `LookupCellRenderer`
   * resolves its target from `reference_to` / `reference`, and
   * `computeLookupExpand` builds `$expand` from the OBJECT SCHEMA's field
   * types, never from this key. A promised-but-not-kept key: #6597 either
   * fixes the spelling chain so the promise becomes real, or withdraws the
   * README line — until it rules, the read stays held here, neither declared
   * nor retired.
   */
  referenceTo?: unknown;
}

/**
 * The candidate keys this seam refuses — DERIVED from the override vocabulary,
 * never hand-listed, so a future `FieldMeta` member has to be adjudicated onto
 * {@link ObjectDataTableColumnHolds} to escape. Keys `TableColumn` declares
 * leave the pool by declaration: `type` (objectui#5853 owns its VALUE set,
 * folded below by `normalizeTableColumnType`) and, since objectui#6425's
 * ruling, `format` / `options` / `currency`.
 *
 * ⚠️ `decimals` USED TO land here — that is how objectui#6425's ruling was
 * enforced at the read site. It no longer can: objectui#6625 retired the
 * `FieldMeta` member itself, so the key is out of this Exclude's POOL rather
 * than out of its exclusion list, and a derived band cannot refuse a key that
 * is not in what it derives from. The refusal is carried by
 * {@link ObjectDataTableRetiredDecimalsTombstone} instead, intersected below.
 * ⛔ Do not read this band's silence about `decimals` as a softening — the two
 * artefacts together are the same verdict, unchanged since 2026-08-27.
 *
 * The pool is what shrank, so what THIS band still refuses is `name` and
 * `label` — both of them `FieldMeta` members with answers this seam already
 * has (see the docblock above).
 */
export type UnheldFieldMetaOverrideKey =
  Exclude<keyof FieldMeta, keyof TableColumn | keyof ObjectDataTableColumnHolds>;

/** The keyhole `enrich` reads the authored column through. See the docblock above. */
export type AuthoredColumnOverrides =
  { accessorKey: string }
  /** DECLARED by `TableColumn`; widened to `string` because the authored value
   *  is folded onto the published union downstream, not at the read. */
  & { type?: string }
  /** DECLARED by `TableColumn` + its zod mirror (objectui#6425, maintainer
   *  ruling 2026-08-27) — the three adjudicated override keys are read at
   *  their published types, straight off the declaration. */
  & Pick<TableColumn, 'format' | 'options' | 'currency'>
  & ObjectDataTableColumnHolds
  & { [K in UnheldFieldMetaOverrideKey]?: never }
  /** RETIRED, objectui#6425's verdict — re-stated by hand because objectui#6625
   *  took the key out of the derived band's pool. See the tombstone's docblock. */
  & ObjectDataTableRetiredDecimalsTombstone;

/**
 * Shared empty fallback for the resolved row list (objectui#4629).
 *
 * `Array.isArray(rawData) ? rawData : []` evaluates a FRESH array on every
 * render, and that value is a dependency of the `derivedColumns` memo below.
 * So for as long as `rawData` is a non-array — a provider-config `data`, or a
 * `bind` path that resolves to an object — the memo's key changes on every
 * render and every column is re-derived (`buildFieldMeta`, a fresh `cell`
 * closure per column, the `isSystemField` pass, the `fieldLabel` lookups) only
 * to be discarded: `finalData.length === 0` is exactly the case in which the
 * component returns its empty state without ever rendering the table.
 * Hoisting the empty to module scope makes "no rows yet" a stable value, so
 * the memo sees what is actually true — nothing changed.
 *
 * The same move `data-table.tsx` made for its own `EMPTY_ROWS` (objectui#4618,
 * PR #4623). This file is the `provider: 'object'` sibling of that one, so it
 * takes the same shape rather than a second remedy for one defect class.
 *
 * Frozen so a consumer that mutates the array it was handed cannot corrupt the
 * shared instance for every other table on the page.
 */
const EMPTY_ROWS = Object.freeze([]) as unknown as any[];

/**
 * Normalize columns to support both string[] shorthand and object[] formats.
 *
 * - `string[]` entries are converted to `{ header, accessorKey }` objects,
 *   handling both snake_case and camelCase for header generation.
 * - Object entries have their field identity AND their display text RESOLVED
 *   here, at the producer, and stamped onto the data-table adapter's own keys
 *   (`accessorKey` / `header`). The adapter reads only those two, and no longer
 *   falls back to `name` / `label` (objectui#5120, objectui#5351).
 *
 * Object entries used to be returned raw (objectui#5120). `accessorKey` is the
 * table LIBRARY's column key — `column-identity.ts` names it
 * `TABLE_ADAPTER_COLUMN_KEY` and deliberately holds the metadata-identity fold
 * away from it — so a column authored in the spec-canonical spelling
 * (`{ field: 'stage' }`) reached the adapter carrying no `accessorKey` at all
 * and rendered a header over `row[undefined]`: blank cells, no warning. The
 * `$expand` whitelist in `computeLookupExpand` missed it for the same reason,
 * so a `field`-spelled lookup column also lost its related record.
 *
 * Resolving it HERE is the move objectui#5022 made in `RelatedList` and
 * objectui#5068 generalized in `ObjectGrid`: metadata vocabulary in, adapter
 * vocabulary out, one translation in one place. The adapter stays monolingual;
 * the producer owns the translation.
 *
 * Mirror, don't move — the same three rules `RelatedList` states:
 *  - an author-supplied `accessorKey` is NEVER overwritten; a deliberate
 *    divergence between the table slot and the metadata key belongs to the
 *    author;
 *  - the authored spelling is left in place, so a host reading `field` / `name`
 *    back off these columns keeps working;
 *  - an entry with neither a resolvable identity nor any display text is
 *    returned UNTOUCHED — nothing is invented for it. It behaves exactly as it
 *    does today: a header over empty cells, silently. Whether that silence
 *    deserves a dev-time diagnostic is objectui#5349's question, and is
 *    deliberately NOT answered here.
 *
 * Returning the INPUT entry by reference when there is nothing to add is load
 * bearing: data-table re-seeds its column state whenever the list is a new
 * object (objectui#4618), and this widget rebuilds its node on every render.
 */
export function normalizeColumns(columns: (string | Record<string, any>)[]): NormalizedColumn[] {
  return columns.map((col) => {
    if (typeof col === 'string') {
      // Shared with the static-table derivation so both halves of the `table`
      // widget family spell a header the same way (objectui#4618).
      return { header: humanizeFieldKey(col), accessorKey: col };
    }
    if (!col) return col as NormalizedColumn;
    const patch: Record<string, unknown> = {};
    // Identity: `accessorKey` is the adapter's key, so an author who supplied
    // it addressed the table directly and is never second-guessed.
    if (!col.accessorKey) {
      const key = columnIdentity(col);
      if (key) patch.accessorKey = key;
    }
    // Display text: the same boundary, seen from the label side
    // (objectui#5351). The spec spells it `label`, the adapter spells it
    // `header`, and the adapter no longer reads `label` — so the translation
    // happens HERE, before delivery, or the column arrives headerless.
    //
    // This is a FIX as well as a move: `enrich` below spreads `buildFieldMeta`'s
    // result over the column, and that result carries its own `label` (built
    // from `col.header`), so an authored `label` was overwritten before it ever
    // reached the adapter's alias. A `{ field, label }` column rendered a BLANK
    // header here even while the alias still existed — measured, not assumed.
    if (!col.header) {
      const text = columnHeader(col);
      if (text) patch.header = text;
    }
    // Nothing to add: return the INPUT entry by reference, so data-table's
    // column-state re-seed stays quiet on the common path (objectui#4618).
    if (Object.keys(patch).length === 0) return col as NormalizedColumn;
    return { ...col, ...patch } as NormalizedColumn;
  });
}

/**
 * ObjectDataTable — Async-aware wrapper for data-table.
 *
 * When `objectName` is provided and a `dataSource` is available via context
 * or props, fetches records automatically and passes them to the registered
 * `data-table` component via SchemaRenderer.
 *
 * Also auto-derives columns from fetched data keys when no explicit columns
 * are configured.
 *
 * Lifecycle states:
 * - **Loading** → skeleton placeholder
 * - **Error** → error message
 * - **Empty** → friendly "No data available" message
 * - **Data** → data-table with fetched rows
 */
/**
 * Compute the list of lookup-typed accessors that should be expanded when
 * fetching rows. Returns column accessors whose object schema field type is
 * a relation. Neither the type family nor the test itself is restated here:
 * this delegates to {@link isLookupType} in `recordFields.tsx`, the package's
 * single relation predicate, which reads `EXPANDABLE_FIELD_TYPES` — the family
 * `@object-ui/core` publishes. Used
 * by the dashboard table widget to ask the data adapter to populate referenced
 * records (e.g. `account: { id, name }`) so cells don't show raw FK ids.
 *
 * THE GATE (objectui#4914, ruling B) runs ahead of the relation test. Measured
 * before the ruling: a `record_owner: { type: 'owner' }` column was ACTIVELY
 * requested for `$expand` — the retired spelling got the full relational read
 * path while the same field's editor answered with a tombstone. It is refused
 * now, loudly and once, and the cell shows the raw id it was always going to
 * show once the spelling stopped being a relation. That the author is TOLD is
 * the whole difference between this and the mechanical deletion the
 * measurement rejected.
 *
 * ## The relation test is core's object, not a private copy (objectui#5692)
 *
 * It used to be the inline literal
 * `t === 'lookup' || t === 'reference' || t === 'master_detail' || t === 'user'`
 * — one of TWO copies this package held (the other `LOOKUP_TYPES` in
 * `recordFields.tsx`), neither deriving from nor pinned against the family core
 * publishes. objectui#5312's claim to have converted "the LAST private copy"
 * was false by these two; they predate that sweep and were outside its file
 * surface.
 *
 * This is the LIVE half of that convergence — `computeLookupExpand` drives a
 * real `$expand` on every dashboard table fetch — so both membership deltas are
 * observable here, and both were decided by measurement (see `isLookupType` in
 * `recordFields.tsx` for the full record):
 *
 *  - a `tree` column now GETS `$expand`-ed, the same treatment the form / grid
 *    road already gives it;
 *  - a `reference` column no longer does, and that is a no-op on spec-compliant
 *    data: the spelling is absent from `@objectstack/spec`'s closed `FieldType`
 *    and refused by `FieldSchema.safeParse`, so no object schema can declare a
 *    field whose stored type is `reference`.
 *
 * ## One predicate, not two that agree by coincidence (objectui#5876)
 *
 * This function used to carry its own `isLookup`, byte-identical to
 * `isLookupType` once objectui#5692 had pointed both at the same set — two
 * bodies that agreed because one sweep aligned them, with nothing keeping them
 * aligned afterwards. The test IS `isLookupType` now, so this module no longer
 * IMPORTS the shared family or the retirement gate and no longer CALLS either
 * (they are named in this prose and nowhere else in the file). That absence is
 * the assertion: a BEHAVIOURAL test cannot see this change, because a
 * byte-identical local copy satisfies every boolean claim you can make about
 * `$expand`. The pin that can see it is the identity pin in
 * `__tests__/expandableFamily.identity-5692.test.ts`.
 */
export function computeLookupExpand(
  schema: { columns?: any[]; objectName?: string },
  objectSchema: any,
): string[] {
  if (!objectSchema?.fields) return [];
  const fieldsByName: Record<string, any> = {};
  if (Array.isArray(objectSchema.fields)) {
    for (const def of objectSchema.fields) if (def?.name) fieldsByName[def.name] = def;
  } else {
    for (const [name, def] of Object.entries(objectSchema.fields)) fieldsByName[name] = { name, ...(def as any) };
  }
  const cols = Array.isArray(schema.columns) ? schema.columns : [];
  const out = new Set<string>();

  if (cols.length > 0) {
    // Explicit columns whitelist: only expand the relations the user asked for.
    // One reader for identity, the same one `normalizeColumns` stamps with
    // (objectui#5120). This used to be `c.accessorKey || c.name` — name-first,
    // and blind to the spec-canonical `field` — so a `field`-spelled lookup
    // column was left out of `$expand` and its cell showed a raw FK id while
    // the whitelist claimed the author had not asked for it. The adapter key
    // still wins when the author supplied one, exactly as it does in
    // `normalizeColumns`, so both halves resolve the same column.
    const accessors = cols
      .map((c: any) => (typeof c === 'string' ? c : (c?.accessorKey || columnIdentity(c))))
      .filter(Boolean);
    for (const acc of accessors) {
      const def = fieldsByName[acc];
      if (def && isLookupType(def.type)) out.add(acc);
    }
  } else {
    // No columns whitelist (auto-derive mode, e.g. drill-down drawer):
    // expand every lookup-type field known from the schema so cells show
    // the related record's display name instead of a bare FK id.
    for (const [name, def] of Object.entries(fieldsByName)) {
      if (isLookupType((def as any)?.type)) out.add(name);
    }
  }
  return Array.from(out);
}

export const ObjectDataTable: React.FC<ObjectDataTableProps> = ({ schema, dataSource: propDataSource, className }) => {
  // Tenant default currency backstops columns that omit an explicit code.
  const { currency: tenantCurrency } = useLocalization();
  // objectui#4553: percent/number cells are FORMATTED inside the memo below,
  // so the locale is both an argument and a dependency of it.
  const displayLocale = useDisplayLocale();
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);
  const { fieldLabel, fieldOptionLabel } = useSafeFieldLabel();
  let noDataLabel = 'No data available';
  let noDataSourceLabel = 'No data source available for';
  // useObjectTranslation is provider-safe (react-i18next falls back to the
  // global instance and never throws), so call it directly — no try/catch,
  // which would make the hook conditional. The English defaults above stand
  // until a translation resolves.
  const { t } = useObjectTranslation();
  const a = t('dashboard.noDataAvailable');
  if (a && a !== 'dashboard.noDataAvailable') noDataLabel = a;
  const b = t('dashboard.noDataSourceFor');
  if (b && b !== 'dashboard.noDataSourceFor') noDataSourceLabel = b;

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  // Start in loading state when we will fetch from a dataSource, so the
  // "No data available" empty state doesn't flash on slow networks before
  // the fetch effect runs and flips loading to true.
  const [loading, setLoading] = useState<boolean>(() => {
    const hasInline = Array.isArray(schema.data) && schema.data.length > 0;
    return !hasInline && !!(schema.objectName);
  });
  const [error, setError] = useState<string | null>(null);

  // --- Drill-to-record ---------------------------------------------------
  // Table / list widgets drill *to record*: clicking a row opens that single
  // record in a detail drawer (the row already IS a record, so there is no
  // filter to derive). Opt-in via `schema.drillDown` — DashboardRenderer
  // defaults object-backed table/list widgets to `{ enabled: true }`.
  const drillDown = schema.drillDown as DrillDownConfig | undefined;
  const recordDrillEnabled = isDrillEnabled(drillDown) && (drillDown?.mode ?? 'record') === 'record';
  const [drillRecord, setDrillRecord] = useState<Record<string, any> | null>(null);
  const handleRowClick = useCallback((row: Record<string, any>) => {
    setDrillRecord(row ?? null);
  }, []);

  // Session scope for `{current_user_id}` / `{current_org_id}` in the schema
  // filter. Read at component level — the fetch below is async, and hooks
  // cannot be called from inside it.
  const filterScope = useFilterScope();

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!dataSource || !schema.objectName) {
        // No way to fetch — clear loading so the empty / no-datasource state
        // can render instead of an indefinite skeleton.
        if (isMounted) setLoading(false);
        return;
      }
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        let data: any[];

        if (typeof dataSource.find === 'function') {
          // If we know the schema, ask the server to expand lookup columns so
          // cells can render the related record's display name instead of a
          // bare FK id. Adapters that don't understand `$expand` ignore it.
          const expand = computeLookupExpand(schema, objectSchema);
          const params: any = { $filter: resolveFilterPlaceholders(schema.filter, filterScope) };
          if (expand.length) params.$expand = expand;
          const results = await dataSource.find(schema.objectName, params);
          data = extractRecords(results);
        } else {
          return;
        }

        if (isMounted) {
          setFetchedData(data);
        }
      } catch (e) {
        console.error('[ObjectDataTable] Fetch error:', e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (schema.objectName && !boundData && (!schema.data || schema.data.length === 0)) {
      fetchData();
    } else if (isMounted) {
      // We have inline / bound data and won't fetch — make sure loading is
      // cleared (matters when we lazily-initialized it to true).
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, objectSchema, filterScope]);

  // Fetch object schema for column-header translation and select-option cell labels.
  useEffect(() => {
    let isMounted = true;
    if (!dataSource || !schema.objectName || typeof dataSource.getObjectSchema !== 'function') {
      return;
    }
    dataSource.getObjectSchema(schema.objectName)
      .then((s: any) => { if (isMounted) setObjectSchema(s); })
      .catch(() => { /* schema lookup failure is non-fatal */ });
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Resolve data: bound data > static schema data > fetched data
  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : EMPTY_ROWS;

  // Auto-derive columns from data keys when none are provided. When `objectName`
  // is set, prefer translated field labels via the convention-based hook so that
  // headers automatically pick up i18n bundles.
  //
  // Each column is also enriched from the bound object schema — `options`,
  // `referenceTo`, `format`, `currency`, `decimals` — and gets a `cell:` render
  // function that delegates to `getCellRenderer` from `@object-ui/fields`. This
  // produces the same type-aware rendering as ObjectGrid / list views and the
  // report viewer (Badge for select, link for lookup, ✓/✗ for boolean,
  // mailto:/tel: links, currency/percent/date formatting honouring the column's
  // `format` prop).
  //
  // ⭐ THAT ENRICHMENT REACHES THE CELL, NOT THE COLUMN (objectui#6373). Those
  // five values live on the `FieldMeta` the `cell` closure captures, which is
  // the only thing that reads them. They used to ALSO be spread onto the column
  // object handed to `data-table`, which declares none of them and reads none of
  // them — five keys that were inert wherever they landed. The emit is checked
  // against `EnrichedColumn` now; see its docstring for the rule and for why
  // annotating `TableColumn` alone could not have enforced it.
  const derivedColumns = useMemo<EnrichedColumn[]>(() => {
    const objectName = schema.objectName;
    const fieldsByName: Record<string, any> = {};
    if (objectSchema?.fields) {
      const f = objectSchema.fields;
      if (Array.isArray(f)) {
        for (const def of f) {
          if (def?.name) fieldsByName[def.name] = def;
        }
      } else {
        for (const [name, def] of Object.entries(f)) {
          fieldsByName[name] = { name, ...(def as any) };
        }
      }
    }

    // The AUTO-DERIVED half of this widget's headers. It spells the convention
    // with `humanizeFieldKey` — the same function `normalizeColumns` (the
    // DECLARED half, above) and `deriveStaticTableColumns` (the static half of
    // the same `table` widget family) already use, whose docstring names itself
    // the single home for this convention "because both halves of the `table`
    // widget family need it and they must agree".
    //
    // This line used to carry a THIRD, inline spelling that split camelCase but
    // never turned `_` into a space, so one field key rendered under two
    // spellings on one dashboard — measured, as headers over the same
    // `crm_opportunity` columns (objectui#5425):
    //
    //   auto-derived (here)                 Close_date · Needs_analysis
    //   declared `columns: ['close_date']`  Close Date · Needs Analysis
    //   static `data-table`, no columns     Close Date · Needs Analysis
    //
    // That is the defect class objectui#5425 rules out — "a value cannot appear
    // twice under two spellings" — so the odd one out adopts the convention
    // rather than the convention gaining a fourth dialect. The i18n wrapper is
    // unchanged: a bundle entry still wins, and this is only its fallback.
    const buildHeader = (k: string) => {
      const humanized = humanizeFieldKey(k);
      return objectName ? fieldLabel(objectName, k, humanized) : humanized;
    };

    const enrich = (col: NormalizedColumn): EnrichedColumn => {
      // ⭐ THE READ SEAM (objectui#6425). Every override below is taken through
      // `AuthoredColumnOverrides` rather than off the bag directly, so each key
      // arrives with the type and the written verdict its docblock gives it,
      // and an unadjudicated `FieldMeta` member is a compile error here instead
      // of an `any` nobody had to justify. This assignment is the enforcement —
      // it is what fails if the authored shape ever grows a banded key.
      const authored: AuthoredColumnOverrides = col;

      // Build the shared FieldMeta (translated select options, resolved
      // referenceTo / currency). Column-level props override the
      // schema-derived values. Lookup fields just pass `referenceTo` through —
      // the server expands them via `$expand` so the cell value is `{ id, name }`,
      // which the lookup/user cell renderers handle natively.
      //
      // `decimals` is NOT read here any more — RETIRED by objectui#6425's
      // ruling (maintainer, 2026-08-27): zero readers were measured for it
      // (`NumberCellRenderer` reads `scale`, `PercentCellRenderer` reads
      // `precision`), so the authored key never reached anything, and the
      // schema-derived value `buildFieldMeta` still resolves is untouched.
      const fieldMeta = buildFieldMeta({
        accessorKey: col.accessorKey,
        label: col.header,
        def: fieldsByName[col.accessorKey],
        objectName,
        fieldOptionLabel,
        overrides: {
          type: authored.type,
          format: authored.format,
          options: authored.options,
          referenceTo: authored.referenceTo,
          currency: authored.currency,
        },
      });

      // Numeric-flavoured columns look better right-aligned (tabular-nums
      // already on the cell). Honor an explicit `align` if the author set one.
      const inferredAlign = (col as any).align
        ?? (isNumericFieldMeta(fieldMeta) ? 'right' : undefined);

      // ⭐ THE SECOND EMIT SEAM (objectui#5853). `buildFieldMeta` returns
      // `type: overrides.type ?? meta?.type` — the OBJECT SCHEMA's field type —
      // which the `...fieldMeta` spread that used to stand here wrote straight
      // into the column's `type`, the same verbatim forwarding `ObjectGrid` does
      // at its own seam. (The spread itself has since retired — objectui#6373 —
      // but this fold is unchanged and still load-bearing: `type` is written out
      // explicitly below, so the value still has to be folded before it lands.)
      // The card's census named ObjectGrid as the only inference producer; this
      // is the second one, and it gets the same fold so `TableColumn.type` only
      // ever holds a value that type declares. An out-of-union type drops the
      // `type` KEY, never the column — display here is driven by `cell` below,
      // which reads `fieldMeta`, not `col.type`, so it is unaffected.
      const columnType = normalizeTableColumnType(fieldMeta.type);

      if (typeof col.cell === 'function') return { ...col, name: fieldMeta.name, type: columnType, align: inferredAlign };

      // Tenant-default currency backstops a currency column with no explicit code.
      const cell = (value: any): React.ReactNode => renderFieldValue(value, fieldMeta, tenantCurrency, displayLocale);
      return { ...col, name: fieldMeta.name, type: columnType, align: inferredAlign, cell };
    };

    if (schema.columns && schema.columns.length > 0) {
      const normalized = normalizeColumns(schema.columns);
      const withHeaders = !objectName
        ? normalized
        : normalized.map((col) => ({ ...col, header: fieldLabel(objectName, col.accessorKey, col.header) }));
      return withHeaders.map(enrich);
    }
    if (finalData.length === 0) return [];

    // Auto-derived columns hide framework/system audit fields by default
    // (shared `isSystemField` denylist). Users wanting them can pass an
    // explicit `columns` whitelist.
    // Prefer the objectSchema field order (declaration order = author intent)
    // and drop system fields. Fall back to the row's keys when no schema
    // is loaded, applying the same denylist.
    const orderedKeys = Object.keys(fieldsByName).length > 0
      ? Object.keys(fieldsByName).filter((k) => !isSystemField(k, fieldsByName[k]))
      : Object.keys(finalData[0]).filter((k) => !k.startsWith('_') && !isSystemField(k));

    return orderedKeys.map((k) => enrich({ header: buildHeader(k), accessorKey: k }));
  }, [schema.columns, schema.objectName, finalData, objectSchema, fieldLabel, fieldOptionLabel, tenantCurrency, displayLocale]);

  // Note: per-cell select-label translation that used to happen here is now
  // handled by SelectCellRenderer in the shared field registry, which also
  // takes care of badge styling and option colors. The raw data is passed
  // straight through to the underlying data-table.

  // Loading skeleton
  if (loading && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-loading">
        <div className="space-y-2 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-error">
        <div className="flex flex-col items-center justify-center py-8 text-destructive" data-testid="table-error-message">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  // No data source available but objectName configured
  if (!dataSource && schema.objectName && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)}>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-xs">{noDataSourceLabel} &ldquo;{schema.objectName}&rdquo;</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-empty-state">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <p className="text-xs">{noDataLabel}</p>
        </div>
      </div>
    );
  }

  // Delegate to data-table via SchemaRenderer. Wrap in a positioned container
  // so the re-fetch indicator can anchor to the top of the table when a
  // refresh is in flight while existing rows remain visible.
  // Honor an author-supplied onRowClick; otherwise wire the drill-to-record
  // handler when drill-down is enabled. The base data-table guards against
  // firing on interactive cells (buttons / menus / dialogs).
  //
  // objectui#6575 — `bind` is CONSUMED here, not passed through: `boundData =
  // useDataScope(schema.bind)` resolved it above and `finalData` below IS that
  // result. Spreading it onward handed the key to `data-table`, which reads no
  // `bind` at all, so a correctly bound (and published-guide-taught) widget
  // tripped that card's ignored-`bind` diagnostic on every render — a warning
  // over rows that were on screen BECAUSE the bind had been honoured. Stop the
  // key where it was spent, the same shape `DashboardGridLayout` already uses
  // for `data`. Pinned by `ObjectDataTable.bindNotForwarded-6575.test.tsx`.
  const { bind: _consumedBind, ...schemaWithoutBind } = schema;
  const tableSchema = {
    ...schemaWithoutBind,
    type: 'data-table',
    data: finalData,
    columns: derivedColumns,
    onRowClick: (schema as any).onRowClick ?? (recordDrillEnabled ? handleRowClick : undefined),
  };

  // A `${event.*}` template (filter-mode title) is meaningless for a single
  // record — fall back to the record's display name in that case.
  const recordTitle =
    drillDown?.title && !drillDown.title.includes('${') ? drillDown.title : undefined;

  return (
    <div className={cn('relative', className)}>
      <RefreshIndicator active={loading && finalData.length > 0} />
      <SchemaRenderer schema={tableSchema} className={className} />
      {recordDrillEnabled && (
        <RecordDetailDrawer
          record={drillRecord}
          objectName={schema.objectName}
          objectSchema={objectSchema}
          fields={drillDown?.columns}
          title={recordTitle}
          target={drillDown?.target === 'dialog' ? 'dialog' : 'drawer'}
          onClose={() => setDrillRecord(null)}
        />
      )}
    </div>
  );
};
