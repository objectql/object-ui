/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Module-scoped store for related-list counts displayed in tab badges
 * (e.g. "Contacts (12)" on an Account detail). The store deduplicates
 * concurrent probes for the same key, lets the renderer subscribe with
 * `useSyncExternalStore`, and exposes invalidation hooks so other parts
 * of the runtime (bulk delete, inline create, optimistic update) can
 * keep the badges in sync without a full page refetch.
 *
 * Design notes:
 *  - One global Map keyed by `${objectName}::${relField}::${parentId}` so
 *    a count fetched by one tab strip is reused by every other consumer. A
 *    probe carrying a declared scope filter (objectui#4664) discriminates
 *    inside the relField segment, so a filtered and an unfiltered count over
 *    the same triple are separate entries rather than one wrong number.
 *  - Subscribers receive *all* keyspace changes; coarse-grained but
 *    badges are cheap to re-render and avoids per-key subscription noise.
 *  - We deliberately avoid Zustand here — the surface area is one Map +
 *    an emit() — and the React binding uses the built-in
 *    `useSyncExternalStore` so we don't grow the dependency graph.
 */

import { useSyncExternalStore } from 'react';
import { subscribeDataChanges } from '@object-ui/react';
import { mergeFilterNodes } from '@object-ui/core';

type Listener = () => void;

interface ProbeFn {
  (
    objectName: string,
    query: {
      /**
       * The parent scope alone (a MongoDB-style object, as it always was), or
       * — once a list declares its own scope — the ObjectQL AST node
       * `mergeFilterNodes` lowers the pair to. Both arms are what the ROW
       * query on the same list already sends, so this union is not a new
       * dialect: it is the same two shapes `RelatedList` puts on the wire.
       */
      $filter?: Record<string, unknown> | unknown[];
      $top?: number;
      $count?: boolean;
    },
  ): Promise<{ total?: number; data?: unknown[] } | unknown[] | { length?: number }>;
}

const counts = new Map<string, number>();
const inflight = new Map<string, Promise<number>>();
const listeners = new Set<Listener>();
// Monotonic store version — the `useSyncExternalStore` snapshot. Bumped on
// every change so React actually re-renders subscribers (returning the
// `counts` Map itself never re-rendered: identical reference, Object.is-equal
// snapshots).
let version = 0;

/**
 * A list's own declared scope, as carried on the `record:related_list` node it
 * badges (objectui#4664 / objectstack#7118). Two probes over the SAME
 * (object, relField, parent) triple are different questions when their scopes
 * differ, so it is part of the cache identity below.
 */
export type CountScopeFilter = Record<string, any> | any[];

/**
 * Cache identity for one probe.
 *
 * The scope rides INSIDE the relField segment rather than as a fourth one, so
 * the two structural reads `invalidate` performs on these strings keep working
 * unchanged: `startsWith(`${objectName}::`)` and — for the parentId-scoped
 * form — `endsWith(`::${parentId}`)`. Appending the scope after the parent id
 * would have silently broken the second, and its failure mode is a badge that
 * never refreshes after a write: no error, just a stale number.
 *
 * With no scope the string is BYTE-IDENTICAL to what it was before this
 * parameter existed, so no cache entry moves and no warm badge goes cold.
 *
 * Keyed on CONTENT (`JSON.stringify`) for the reason `RelatedList` keys its own
 * filter memo that way: an inline filter object on a schema node is a new
 * identity every render, and identity-keying would miss the cache every time.
 */
function key(
  objectName: string,
  relField: string | undefined,
  parentId: string | undefined,
  filter?: CountScopeFilter,
): string {
  const scope = filter === undefined ? (relField ?? '') : `${relField ?? ''}#${JSON.stringify(filter)}`;
  return `${objectName}::${scope}::${parentId ?? ''}`;
}

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

function getCount(
  objectName: string,
  relField: string | undefined,
  parentId: string | undefined,
  filter?: CountScopeFilter,
): number | undefined {
  return counts.get(key(objectName, relField, parentId, filter));
}

function setCount(
  objectName: string,
  relField: string | undefined,
  parentId: string | undefined,
  value: number,
  filter?: CountScopeFilter,
): void {
  const k = key(objectName, relField, parentId, filter);
  const prev = counts.get(k);
  if (prev === value) return;
  counts.set(k, value);
  emit();
}

/**
 * Probe a count via the supplied finder. Deduplicates concurrent requests
 * for the same key and caches the resulting number until invalidated.
 */
async function fetchCount(
  probe: ProbeFn,
  objectName: string,
  relField: string | undefined,
  parentId: string | undefined,
  filter?: CountScopeFilter,
): Promise<number> {
  const k = key(objectName, relField, parentId, filter);
  const cached = counts.get(k);
  if (cached !== undefined) return cached;
  const pending = inflight.get(k);
  if (pending) return pending;

  const promise = (async () => {
    // The data source convention across this codebase is `$filter` /
    // `$top` (OData-ish). Earlier versions of this file used `where` /
    // `limit` which most adapters silently ignored, so the probe ended
    // up fetching the entire target table and returning its global
    // count — completely wrong for parent-scoped badges.
    const parentScope: Record<string, unknown> = {};
    if (relField) {
      if (!parentId) return 0;
      parentScope[relField] = parentId;
    }
    // objectui#4664 — the parent relationship AND the list's own declared
    // scope, composed exactly as `RelatedList` composes them for the ROWS
    // (`mergeFilterNodes(parentScope, listFilterNode)`). That shared sink is
    // what makes badge/row parity a property of the code rather than of two
    // implementations agreeing by luck: the badge cannot count a set the list
    // does not show, because both sides send the same `$filter`.
    //
    // The parent condition is never negotiable — a declared filter may only
    // NARROW this parent's children — and `mergeFilterNodes` guarantees that
    // by wrapping both sources under one `and` rather than letting either
    // replace the other.
    //
    // With nothing declared the query is the untouched MongoDB-style object it
    // has always been, rather than a freshly lowered AST that means the same
    // thing: same reason `RelatedList` guards its own call this way. The
    // difference is invisible on screen and visible to every caller pinning
    // the wire.
    const $filter =
      filter === undefined ? parentScope : (mergeFilterNodes(parentScope, filter) ?? parentScope);
    try {
      // Request the server-side count instead of relying on the page length.
      // Without `$count: true` most adapters omit `total`, and we'd fall
      // back to `data.length` which is capped to `$top: 1` → badge
      // shows "1" no matter how many rows exist.
      //
      // The count reads `total` — the ONE count member `QueryResult`
      // (`@object-ui/types`) declares — then falls back to the ONE rows member
      // it declares, `data`. Nothing else.
      //
      // Two tolerant arms were removed from this expression, each on its own
      // measurement. `records` FIRST, ahead of `data` (objectui#5945,
      // objectui#6726). Then `count` SECOND, still ahead of `data`
      // (objectui#6840): `count` is the RAW-payload spelling that
      // `ObjectStackAdapter.normalizeQueryResult` and
      // `ApiDataSource.normalizeQueryResult` both fold into `total` BELOW this
      // seam, so no producer emits it here — a sweep of all 452 `find()`
      // definition bodies in the repo found `count` emitted 0 times against
      // controls `total` (85) and `data` (135) drawn from the same cells.
      // `ProbeFn` above never declared either spelling — only the `any` here
      // let them through. Pinned by
      // `related-count-store.contractEnvelope-6726.test.ts` and
      // `related-count-store.contractEnvelope-6840.test.ts`; ⛔ do not re-add a
      // tolerant arm, and ⛔ do not widen `QueryResult` to bless `records` or
      // `count` (a published-type change, maintainer's call).
      const res: any = await probe(objectName, { $filter, $top: 1, $count: true });
      const total =
        typeof res?.total === 'number'
          ? res.total
          : Array.isArray(res?.data)
            ? res.data.length
            : Array.isArray(res)
              ? res.length
              : 0;
      const n = typeof total === 'number' ? total : 0;
      setCount(objectName, relField, parentId, n, filter);
      return n;
    } catch {
      return 0;
    } finally {
      inflight.delete(k);
    }
  })();

  inflight.set(k, promise);
  return promise;
}

/**
 * Invalidate every cached count that involves the given object. Called by
 * mutation paths (e.g. ObjectGrid's onBulkDelete callback, drawer save) so
 * the badge updates without forcing a parent re-render.
 *
 * When `parentId` is supplied, only entries whose parentId matches are
 * dropped — useful for "I just created one Contact under Account X".
 */
function invalidate(objectName: string, parentId?: string): void {
  let changed = false;
  const prefix = `${objectName}::`;
  for (const k of counts.keys()) {
    if (!k.startsWith(prefix)) continue;
    if (parentId !== undefined && !k.endsWith(`::${parentId}`)) continue;
    counts.delete(k);
    changed = true;
  }
  if (changed) emit();
}

function invalidateAll(): void {
  if (counts.size === 0) return;
  counts.clear();
  emit();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot(): number {
  return version;
}

/**
 * Subscribe to the related-count store and read the count for a single
 * (object, relField, parentId) triple. Returns `undefined` while the
 * probe is in flight or before the first request.
 */
export function useRelatedCount(
  objectName: string | undefined,
  relField: string | undefined,
  parentId: string | undefined,
  filter?: CountScopeFilter,
): number | undefined {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!objectName) return undefined;
  return getCount(objectName, relField, parentId, filter);
}

/**
 * Subscribe to the store's monotonic version. Put it in an effect dependency
 * array to RE-RUN count probes after an invalidation (#2269) — invalidate
 * deletes the cached numbers, and this version bump is what makes the probe
 * effect fetch them again (fetchCount returns cached values without emitting,
 * so the loop settles once every probed key is warm again).
 */
export function useRelatedCountVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Imperative store API for non-React callers (mutation handlers, tests).
 * Prefer `useRelatedCount` in components.
 */
export const RelatedCountStore = {
  get: getCount,
  set: setCount,
  fetch: fetchCount,
  invalidate,
  invalidateAll,
  // Exposed for test isolation only — production code should never need this.
  _reset: () => {
    counts.clear();
    inflight.clear();
    emit();
  },
};

// #2269 — wire the store to the data-invalidation bus: any change to an
// object (form save, record action, undo, any dataSource write via the
// MutationEvent bridge) invalidates its related-count badges everywhere.
// Module-scope on purpose: the store itself is module-scoped, and this keeps
// the wiring next to the thing it wires (one subscription per bundle).
subscribeDataChanges((change) => {
  if (change.objectName === '*') RelatedCountStore.invalidateAll();
  else RelatedCountStore.invalidate(change.objectName);
});
