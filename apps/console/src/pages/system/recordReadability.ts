// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Per-row record readability for the Approvals Inbox (objectui#5211).
 *
 * ## The affordance this exists to remove
 *
 * Approver resolution routes on positions; record visibility is a separate
 * gate, and nothing reconciles the two. So an approver can be routed a request
 * about a record they cannot read — the inbox then offers a record link that,
 * for the person it is offered to, lands on "Record not found — the record you
 * are looking for does not exist or may have been deleted". The approval
 * itself is fine (the drawer carries the request's payload snapshot and the
 * decision path never touches the record read); what is broken is the link.
 *
 * The maintainer's ruling (2026-08-19, recorded on objectui#5211) is to
 * **suppress the link when the viewer cannot read the target**, decided per row
 * by this probe.
 *
 * ## ⛔ What this deliberately does NOT do
 *
 * It does not change, soften, or report on the server's answer. The server
 * replies `404 RECORD_NOT_FOUND` — not `403` — to a by-id read of a record
 * filtered out of the principal's row set, **on purpose**: 404 is how it
 * declines to confirm that a record exists to someone not permitted to see it.
 * Telling the viewer "you do not have access to this record" would confirm
 * exactly that, so no copy here says it, and nothing here asserts anything
 * about 404-vs-403. A suppressed link is silent: the row still shows the
 * record's title from the request's own payload snapshot (which the approver
 * was already given), just not as a link into a page they cannot open.
 *
 * The probe cannot widen access either. It is an ordinary list read issued as
 * the signed-in viewer, under the viewer's own grants — the same read the
 * record page would perform one click later. It only moves the answer earlier.
 *
 * ## Cost — why this is batchable
 *
 * The probe is **per distinct object, not per row**: every row's `record_id` for
 * one `object_name` goes into a single `id in (…)` list read, projected down to
 * the id column. A page of N rows spanning K objects costs `K` calls (K ≈ 1–2 in
 * practice), not N — and rows already probed are never re-probed, so paging in
 * more rows costs only the new ids. See `planReadabilityProbe`, which IS the
 * cost model and is pinned by `recordReadability.test.ts`.
 *
 * ## Fail-open, always
 *
 * An unanswered or failed probe leaves the target **unknown**, and an unknown
 * target keeps its link. This is an affordance, not an access control — the
 * server stays the only authority — so the failure mode of the probe must be
 * today's behaviour (a link that may dead-end), never a link withheld from
 * someone who could have used it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdapter } from '@object-ui/app-shell';
import type { QueryParams } from '@object-ui/types';

/** The two fields of an approval request that address its target record. */
export interface ReadabilityTarget {
  object_name?: string | null;
  record_id?: string | null;
}

/**
 * Minimal structural view of the data source the probe needs. Declared here
 * rather than importing the adapter type so the probe is testable with a
 * counting stub — and so it can never reach for anything but a list read.
 */
export interface ReadabilityProbeSource {
  find(objectName: string, params?: QueryParams): Promise<unknown>;
}

/**
 * Ids per list read. One call per object is the shape that matters; the cap
 * only keeps a very long queue from building a single unbounded `$in` (and an
 * over-long URL) — at PAGE_SIZE = 50 rows per page it is never reached.
 */
export const READABILITY_PROBE_CHUNK = 100;

/**
 * Key for one target in the readability map.
 *
 * `::` is unambiguous here because object names are metadata identifiers
 * (`[a-z0-9_]`), so the first `::` always separates object from record id.
 * (A control byte as separator would be unsearchable and trips
 * `check:control-bytes` — see `scripts/check-control-bytes.mjs`.)
 */
export function readabilityKey(objectName: string, recordId: string): string {
  return `${objectName}::${recordId}`;
}

/** A target the probe can actually ask about. */
function probeable(t: ReadabilityTarget): t is { object_name: string; record_id: string } {
  return typeof t.object_name === 'string' && t.object_name !== ''
    && typeof t.record_id === 'string' && t.record_id !== '';
}

/** One batched list read: every id below belongs to `objectName`. */
export interface ReadabilityProbeGroup {
  objectName: string;
  ids: string[];
}

/**
 * Group targets into the list reads that answer them — **the cost model**.
 *
 * `groups.length` is exactly the number of network calls a render adds, so a
 * test can assert the cost directly instead of describing it. Ids are deduped
 * per object and kept in first-seen order (stable output for stable input).
 */
export function planReadabilityProbe(
  targets: readonly ReadabilityTarget[],
): ReadabilityProbeGroup[] {
  const byObject = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const t of targets) {
    if (!probeable(t)) continue;
    const key = readabilityKey(t.object_name, t.record_id);
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = byObject.get(t.object_name);
    if (ids) ids.push(t.record_id);
    else byObject.set(t.object_name, [t.record_id]);
  }
  const groups: ReadabilityProbeGroup[] = [];
  for (const [objectName, ids] of byObject) {
    for (let i = 0; i < ids.length; i += READABILITY_PROBE_CHUNK) {
      groups.push({ objectName, ids: ids.slice(i, i + READABILITY_PROBE_CHUNK) });
    }
  }
  return groups;
}

/** Rows come back as a bare array from some adapters and `{ data }` from others. */
function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const data = (result as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
}

/**
 * Ask the data source which of `targets` this viewer can read.
 *
 * Returns a map of {@link readabilityKey} → readable. A key is **absent** when
 * its group's read failed — unknown, never guessed — because callers must
 * fail open (see the module header).
 *
 * Never rejects: a per-group failure drops that group's answers and leaves the
 * rest intact, so one denied object cannot blank the whole inbox.
 */
export async function probeRecordReadability(
  source: ReadabilityProbeSource,
  targets: readonly ReadabilityTarget[],
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const groups = planReadabilityProbe(targets);
  await Promise.all(groups.map(async ({ objectName, ids }) => {
    let readable: Set<string>;
    try {
      // `$top` is pinned to the batch size: a server-side default page size
      // smaller than the batch would truncate the answer and read as "these
      // ids are unreadable" — a link withheld from someone who could use it.
      const result = await source.find(objectName, {
        $filter: { id: { $in: ids } },
        $select: ['id'],
        $top: ids.length,
      });
      readable = new Set(
        rowsOf(result)
          .map((row) => row?.id)
          .filter((id): id is string => typeof id === 'string' && id !== ''),
      );
    } catch {
      // Unknown, so the caller keeps the link. Deliberately silent: a viewer
      // without access to an object hits this on every load, and a console
      // error per row would be noise, not a signal.
      return;
    }
    for (const id of ids) out.set(readabilityKey(objectName, id), readable.has(id));
  }));
  return out;
}

/** What a row asks the probe at render time. */
export interface RecordReadability {
  /**
   * `true` only when the probe has answered and the answer is "cannot read".
   * Unknown (not yet probed, probe failed, no data source) reads as `false`,
   * which keeps the link — see the module header on failing open.
   */
  isUnreadable(target: ReadabilityTarget): boolean;
}

/**
 * Probe the targets a render needs and keep the answers.
 *
 * Each (object, id) is probed at most once per mount: newly loaded rows cost
 * only their own ids, and re-renders (search typing, the minute clock, a
 * drawer opening) cost nothing. The trade is that an access grant made while
 * the page is open is not picked up until it is reloaded — acceptable for an
 * affordance, and it fails in the direction that keeps a link rather than
 * hiding one.
 */
export function useRecordReadability(targets: readonly ReadabilityTarget[]): RecordReadability {
  const adapter = useAdapter();
  const [known, setKnown] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  /** Keys already handed to a probe — the "probe once" ledger. */
  const attempted = useRef<Set<string>>(new Set());
  /** Latest targets without making them an effect dependency (see `signature`). */
  const latest = useRef<readonly ReadabilityTarget[]>(targets);
  latest.current = targets;

  // `targets` is a fresh array every render, so the effect keys off the SET of
  // targets rather than the array's identity.
  const signature = useMemo(
    () => targets
      .filter(probeable)
      .map((t) => readabilityKey(t.object_name, t.record_id))
      .join('|'),
    [targets],
  );

  useEffect(() => {
    if (!adapter) return;
    const fresh = latest.current.filter(
      (t) => probeable(t) && !attempted.current.has(readabilityKey(t.object_name, t.record_id)),
    );
    if (fresh.length === 0) return;
    for (const t of fresh) {
      if (probeable(t)) attempted.current.add(readabilityKey(t.object_name, t.record_id));
    }
    let cancelled = false;
    void probeRecordReadability(adapter, fresh).then((result) => {
      if (cancelled || result.size === 0) return;
      setKnown((prev) => {
        const next = new Map(prev);
        for (const [key, value] of result) next.set(key, value);
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [adapter, signature]);

  return useMemo<RecordReadability>(() => ({
    isUnreadable: (target) =>
      probeable(target)
      && known.get(readabilityKey(target.object_name, target.record_id)) === false,
  }), [known]);
}
