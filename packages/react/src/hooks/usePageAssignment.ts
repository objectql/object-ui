/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `usePageAssignment` — resolve the record PageSchema that should be rendered
 * for a given object. Walks the metadata cache exposed by `<MetadataProvider>`
 * and returns the first PageSchema whose `pageType === 'record'` and `object`
 * matches the requested name.
 *
 * Returns a discriminated result by `PageSchema.kind`:
 *   - `kind === 'full'` (default): the schema fully describes the page;
 *     the result populates `page` and the caller renders it as-is.
 *   - `kind === 'slotted'`: the schema only provides slot overrides;
 *     the result populates `slots` and the caller feeds them to
 *     `buildDefaultPageSchema(objectDef, { slots })` so omitted slots
 *     fall through to synthesized defaults.
 *
 * Future work (deferred): recordType / profile / app / formFactor filtering
 * and priority-based selection. For now we return the first match so that
 * callers can deterministically fall back to the auto-generated DetailView
 * when no record Page is authored.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMetadata } from '../context/AppShellContext.js';

export interface PageAssignmentOptions {
  /** Salesforce-style record type filter (reserved for future use). */
  recordType?: string;
  /** User profile filter (reserved for future use). */
  profile?: string;
  /** Owning app filter (reserved for future use). */
  app?: string;
  /** Form factor filter (reserved for future use). */
  formFactor?: 'desktop' | 'tablet' | 'phone';
  /** Optional explicit page name override; bypasses object-based lookup. */
  pageName?: string;
}

export interface PageAssignmentResult {
  /**
   * Resolved full PageSchema, or null when none is available.
   *
   * Populated only when the matched page has `kind === 'full'` (the
   * default — see `PageSchema.kind`). Slotted pages do NOT populate
   * this field; callers should branch on `slots` instead.
   */
  page: any | null;
  /**
   * Slot override map for the matched slotted page, or null when no
   * slotted page matched.
   *
   * Populated only when the matched page has `kind === 'slotted'`.
   * The caller is expected to feed these slots to the default-page
   * synthesizer (`buildDefaultPageSchema(objectDef, { slots })`) so
   * that omitted slots fall through to synthesized defaults.
   */
  slots: any | null;
  /** True while the metadata cache is still loading the `page` type. */
  loading: boolean;
  /** Loader error, if any. */
  error: Error | null;
}

function matchesAssignment(_page: any, _opts: PageAssignmentOptions): boolean {
  // Placeholder — every page matches until rules-based assignment lands.
  return true;
}

/**
 * Resolve the record PageSchema for the given object name. Returns `null`
 * when no record Page is configured, signalling the caller to fall back
 * to the auto-generated detail view.
 */
export function usePageAssignment(
  objectName: string | undefined | null,
  opts: PageAssignmentOptions = {},
): PageAssignmentResult {
  const meta = useMetadata();
  const [ensured, setEnsured] = useState(false);
  const [ensureError, setEnsureError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!meta.ensureType) {
      setEnsured(true);
      return;
    }
    meta
      .ensureType('page')
      .then(() => {
        if (!cancelled) {
          setEnsured(true);
          setEnsureError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setEnsureError(err instanceof Error ? err : new Error(String(err)));
          setEnsured(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  const matched = useMemo(() => {
    if (!objectName && !opts.pageName) return null;
    const pages: any[] = Array.isArray(meta.pages) ? meta.pages : [];
    if (!pages.length) return null;

    // Explicit page name override wins.
    if (opts.pageName) {
      return pages.find(p => p?.name === opts.pageName) ?? null;
    }

    const candidates = pages.filter(p => {
      if (!p) return false;
      // Only `pageType: 'record'` (or bare `type: 'record'`) is a
      // user-facing record-detail page. Any other `pageType` — notably the
      // designer-side `'record_detail'`, dropped from `PageType` in
      // framework#2265 but still expressible in raw metadata — must NOT be
      // picked up here, otherwise opening any record would render it.
      const pt = p.pageType ?? (p.type === 'record' ? 'record' : undefined);
      const isRecord = pt === 'record';
      if (!isRecord) return false;
      if (p.object !== objectName) return false;
      return matchesAssignment(p, opts);
    });

    if (!candidates.length) return null;

    // Stable ordering: respect explicit `priority` if present (higher wins),
    // otherwise fall back to declaration order.
    candidates.sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0));
    return candidates[0];
  }, [meta.pages, objectName, opts.pageName, opts.recordType, opts.profile, opts.app, opts.formFactor]);

  // Discriminate by `kind`: full pages populate `page`, slotted pages
  // populate `slots`. Missing `kind` defaults to 'full' for backwards
  // compatibility with pre-Phase-I metadata.
  const { page, slots } = useMemo(() => {
    if (!matched) return { page: null, slots: null };
    if (matched.kind === 'slotted') {
      return { page: null, slots: matched.slots ?? {} };
    }
    return { page: matched, slots: null };
  }, [matched]);

  return {
    page,
    slots,
    loading: meta.loading || !ensured,
    error: ensureError ?? meta.error ?? null,
  };
}

export default usePageAssignment;
