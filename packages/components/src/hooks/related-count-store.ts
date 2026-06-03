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
 *    a count fetched by one tab strip is reused by every other consumer.
 *  - Subscribers receive *all* keyspace changes; coarse-grained but
 *    badges are cheap to re-render and avoids per-key subscription noise.
 *  - We deliberately avoid Zustand here — the surface area is one Map +
 *    an emit() — and the React binding uses the built-in
 *    `useSyncExternalStore` so we don't grow the dependency graph.
 */

import { useSyncExternalStore } from 'react';

type Listener = () => void;

interface ProbeFn {
  (
    objectName: string,
    query: { $filter?: Record<string, unknown>; $top?: number; $count?: boolean },
  ): Promise<{ total?: number; data?: unknown[] } | unknown[] | { length?: number }>;
}

const counts = new Map<string, number>();
const inflight = new Map<string, Promise<number>>();
const listeners = new Set<Listener>();

function key(objectName: string, relField: string | undefined, parentId: string | undefined): string {
  return `${objectName}::${relField ?? ''}::${parentId ?? ''}`;
}

function emit(): void {
  for (const l of listeners) l();
}

function getCount(objectName: string, relField: string | undefined, parentId: string | undefined): number | undefined {
  return counts.get(key(objectName, relField, parentId));
}

function setCount(
  objectName: string,
  relField: string | undefined,
  parentId: string | undefined,
  value: number,
): void {
  const k = key(objectName, relField, parentId);
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
): Promise<number> {
  const k = key(objectName, relField, parentId);
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
    const $filter: Record<string, unknown> = {};
    if (relField) {
      if (!parentId) return 0;
      $filter[relField] = parentId;
    }
    try {
      // Request the server-side count instead of relying on the page length.
      // Without `$count: true` most adapters omit `total`, and we'd fall
      // back to `records.length` which is capped to `$top: 1` → badge
      // shows "1" no matter how many rows exist.
      const res: any = await probe(objectName, { $filter, $top: 1, $count: true });
      const total =
        typeof res?.total === 'number'
          ? res.total
          : typeof res?.count === 'number'
            ? res.count
            : Array.isArray(res?.records)
              ? res.records.length
              : Array.isArray(res?.data)
                ? res.data.length
                : Array.isArray(res)
                  ? res.length
                  : 0;
      const n = typeof total === 'number' ? total : 0;
      setCount(objectName, relField, parentId, n);
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

function getSnapshot(): Map<string, number> {
  return counts;
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
): number | undefined {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!objectName) return undefined;
  return getCount(objectName, relField, parentId);
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
