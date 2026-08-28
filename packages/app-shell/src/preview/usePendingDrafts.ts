/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5801 — the ONE pending-drafts data source.
 *
 * "Has unpublished changes" used to be answered by five surfaces with five
 * hand-rolled copies of the same `GET /api/v1/meta/_drafts` fetch (home
 * banner, Studio topbar, chat bar, chat draft-card resolver, preview
 * watermark), each with its own refresh trigger and none of them telling the
 * others when a publish happened — measured live: the home banner reported
 * 1 pending change while the Studio topbar reported none, and a publish from
 * the Studio dock never updated the Studio topbar count.
 *
 * This module is the single copy:
 *  - {@link fetchPendingDrafts} is the fetch + response-shape tolerance
 *    (`[...]`, `{drafts}`, `{data:{drafts}}` — every shape a deployed server
 *    has answered with).
 *  - {@link usePendingDrafts} keeps a live count/entry list for a scope and
 *    subscribes to the assistant bus's metadata-refresh pulse, so ANY
 *    publish/install that announces itself converges every surface at once.
 *
 * Publishing deliberately stays with each surface (their failure handling and
 * toasts differ on purpose); the contract is that every successful publish
 * path calls `emitMetadataRefresh()` — that pulse, plus this hook, is the
 * whole unification mechanism.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeMetadataRefresh } from '../assistant/assistantBus.js';

export interface PendingDraftEntry {
  /** Raw stored type — callers that build `/meta` URLs must fold it themselves. */
  type: string;
  name: string;
  packageId: string | null;
}

export async function fetchPendingDrafts(
  packageId?: string | null,
): Promise<PendingDraftEntry[]> {
  const qs = packageId ? `?packageId=${encodeURIComponent(packageId)}` : '';
  const res = await fetch(`/api/v1/meta/_drafts${qs}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`_drafts HTTP ${res.status}`);
  const data = (await res.json()) as
    | Array<Record<string, unknown>>
    | { drafts?: Array<Record<string, unknown>>; data?: { drafts?: Array<Record<string, unknown>> } };
  const list = Array.isArray(data) ? data : (data?.drafts ?? data?.data?.drafts ?? []);
  return (Array.isArray(list) ? list : [])
    .filter((d) => typeof d?.type === 'string' && typeof d?.name === 'string')
    .map((d) => ({
      type: d.type as string,
      name: d.name as string,
      packageId: typeof d.packageId === 'string' && d.packageId ? (d.packageId as string) : null,
    }));
}

export interface UsePendingDraftsOptions {
  /** Scope: a packageId for per-app surfaces, undefined/null for env-wide. */
  packageId?: string | null;
  /** False = hold fetching (e.g. no bound package yet). Default true. */
  enabled?: boolean;
}

export interface UsePendingDraftsResult {
  /** null until the first successful read (lets callers hold rendering). */
  count: number | null;
  entries: PendingDraftEntry[];
  /** Manual refetch — for surface-local triggers (draft saved, turn idle). */
  refresh: () => Promise<void>;
}

export function usePendingDrafts(opts: UsePendingDraftsOptions = {}): UsePendingDraftsResult {
  const { packageId, enabled = true } = opts;
  const [entries, setEntries] = useState<PendingDraftEntry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  // A single in-flight guard + generation counter: a refresh started before a
  // scope change must not land its stale answer on the new scope.
  const genRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const gen = ++genRef.current;
    try {
      const list = await fetchPendingDrafts(packageId);
      if (genRef.current !== gen) return;
      setEntries(list);
      setCount(list.length);
    } catch {
      // An errored read means UNKNOWN, not zero: count stays null so surfaces
      // that must fail SAFE on unknown (the preview bar keeps its Publish
      // visible) can tell the difference from a known-empty ledger; count-only
      // banners hide on null exactly as they hide on 0.
      if (genRef.current !== gen) return;
      setEntries([]);
      setCount(null);
    }
  }, [packageId, enabled]);

  useEffect(() => {
    if (!enabled) {
      genRef.current++;
      setEntries([]);
      setCount(null);
      return;
    }
    void refresh();
    return subscribeMetadataRefresh(() => {
      void refresh();
    });
  }, [refresh, enabled]);

  return { count, entries, refresh };
}
