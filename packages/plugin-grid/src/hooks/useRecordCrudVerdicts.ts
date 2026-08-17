/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * May this user write THESE rows? (objectui#4296)
 *
 * The object-level grant is not the write verdict on a record. `writeScope`,
 * the sharing model and RLS narrow it per row, so a list that ANDs only the
 * object-level answer offers Edit/Delete on every row the user can READ —
 * including the rows the server answers `403 "You do not have access to this
 * record"` for. The record detail header has folded the record-grained verdict
 * since objectstack#3821 (`plugin-detail`'s `useRecordEditable`), which is why
 * one screen carried two opposite answers for one record and one user.
 *
 * This hook is the list-shaped half of the same question. It asks the SAME
 * authority the detail header asks — the explain engine's record-grained
 * verdict (`POST /api/v1/security/explain`, ADR-0090 D6 / ADR-0095 C2), the
 * same pipeline the enforcement middleware runs — so the kebab and the server
 * cannot disagree, and neither can the kebab and the detail header.
 *
 * ## One call per (object, operation) per page, not two per row
 *
 * The singular probe the detail header uses answers ONE record. Folding it into
 * a list row-by-row would cost 2N round trips (a 50-row page = 100 POSTs), and
 * that cost is why this card sat blocked: the batch form
 * (`recordIds: string[]`, objectstack#8326, shipped in objectstack PR #8452) is
 * what makes a page-level fold affordable. `records[i]` answers `recordIds[i]`;
 * each entry is the verdict the singular form returns for that id, so the list
 * and the detail header read the same number by construction rather than by
 * two implementations agreeing.
 *
 * ## Fail OPEN on every uncertainty — degrade to today, never over-hide
 *
 * No answer yet, a non-OK response, a deployment without
 * `@objectstack/plugin-security`, a row missing from the verdict map, a split
 * SPA origin where the cookie doesn't reach the API: the row's verdict is
 * `undefined` and the caller keeps the OBJECT-level answer, i.e. exactly what
 * this list rendered before this hook existed. The server is the authority
 * (ADR-0057 D10) and stays so; hiding a capability on missing data would be a
 * worse defect than the wasted click this fixes, and it is the same posture
 * `useRecordEditable` takes for the detail header.
 *
 * The probe rides the host's AUTHENTICATED fetch (`SchemaRendererProvider`'s
 * `apiFetch`) rather than the bare global one: a bearer-token session carries
 * its credential in a header, not a cookie, so `credentials: 'include'` alone
 * would 401 on a perfectly valid session and the verdict would always fail open
 * (framework#3923 ②, measured on the singular probe). Cookies stay on for
 * cookie-session hosts.
 */
import * as React from 'react';
import { SchemaRendererContext } from '@object-ui/react';

/** The two write verbs a list row's kebab can offer. */
export type RecordCrudOperation = 'update' | 'delete';

/**
 * Hard cap on `recordIds` per batch explain request — the SERVER's contract
 * (`EXPLAIN_BATCH_MAX_RECORD_IDS`, objectstack#8326): over-cap requests are
 * refused with `400 VALIDATION_FAILED`, never truncated, and the spec's own
 * TSDoc directs a consumer with more records to paginate under it. A page
 * larger than the cap is therefore split into ceil(N / 200) requests per
 * operation — still amortized, never one per row.
 *
 * Declared locally because the pinned `@objectstack/spec@17.0.0-rc.6` predates
 * the batch form and exports neither the constant nor the request/response
 * types; the pin bump (objectui#4636) supersedes this declaration.
 */
const EXPLAIN_BATCH_MAX_RECORD_IDS = 200;

/**
 * One entry of the batch response's `records` array, narrowed to what this hook
 * reads. Wire payloads are `unknown` until proven otherwise — a malformed entry
 * must land on "no verdict for this row" (fail open), never on a coerced
 * boolean.
 */
interface WireRecordVerdict {
  recordId?: unknown;
  visible?: unknown;
}

/**
 * A settled verdict lookup for the rows on screen.
 *
 * `undefined` means UNKNOWN — not "denied". Every caller must treat it as the
 * instruction to keep the object-level answer.
 */
export type RecordCrudVerdictLookup = (
  recordId: string | number | null | undefined,
  operation: RecordCrudOperation,
) => boolean | undefined;

/**
 * Verdicts memoised across pages and renders, keyed `object:recordId:operation`
 * — the same key shape and the same "revisiting is free" posture as
 * `useRecordEditable`'s cache, so paging back and forth costs nothing and the
 * two surfaces answer a record identically for the life of the session.
 */
const verdictCache = new Map<string, boolean>();

const cacheKey = (object: string, recordId: string, operation: RecordCrudOperation): string =>
  `${object}:${recordId}:${operation}`;

/** Test seam — drops the memoised verdicts. */
export function __clearRecordCrudVerdictCache(): void {
  verdictCache.clear();
}

const NO_VERDICTS: RecordCrudVerdictLookup = () => undefined;

export function useRecordCrudVerdicts(opts: {
  /** The object the rows belong to; absent (element data source) = no question to ask. */
  objectName?: string;
  /** The record ids on screen. Order is irrelevant; duplicates are harmless. */
  recordIds: readonly string[];
  /**
   * Ask about `update` at all. Pass the OBJECT-level verdict: when the object
   * answer already hides the entry, the record answer cannot change anything,
   * so the request is not worth sending.
   */
  update?: boolean;
  /** Ask about `delete` at all. Same gate as {@link update}. */
  delete?: boolean;
}): RecordCrudVerdictLookup {
  const { objectName, recordIds, update: wantUpdate, delete: wantDelete } = opts;
  // Read the context directly (not `useSchemaContext`, which throws when no
  // provider is mounted): a standalone grid embed has no host fetch and must
  // still degrade to the global one rather than crash the render.
  const apiFetch = React.useContext(SchemaRendererContext)?.apiFetch;

  // The id LIST is re-derived from a stable key so this hook cannot loop on a
  // caller that rebuilds the array each render — and so the effect's dependency
  // array stays exhaustive rather than suppressed.
  const idsKey = JSON.stringify(recordIds);
  const ids = React.useMemo<readonly string[]>(() => JSON.parse(idsKey) as string[], [idsKey]);

  const [verdicts, setVerdicts] = React.useState<ReadonlyMap<string, boolean>>(() => new Map());

  React.useEffect(() => {
    const operations: RecordCrudOperation[] = [];
    if (wantUpdate) operations.push('update');
    if (wantDelete) operations.push('delete');
    if (!objectName || ids.length === 0 || operations.length === 0) {
      setVerdicts(new Map());
      return;
    }
    let cancelled = false;
    const doFetch = apiFetch ?? fetch;

    /** Publish what the cache holds for the rows on screen — nothing else. */
    const publish = () => {
      const next = new Map<string, boolean>();
      for (const operation of operations) {
        for (const id of ids) {
          const verdict = verdictCache.get(cacheKey(objectName, id, operation));
          if (typeof verdict === 'boolean') next.set(`${operation}:${id}`, verdict);
        }
      }
      setVerdicts(next);
    };

    void (async () => {
      await Promise.all(operations.map(async (operation) => {
        const missing = ids.filter((id) => !verdictCache.has(cacheKey(objectName, id, operation)));
        for (let i = 0; i < missing.length; i += EXPLAIN_BATCH_MAX_RECORD_IDS) {
          const chunk = missing.slice(i, i + EXPLAIN_BATCH_MAX_RECORD_IDS);
          try {
            const res = await doFetch('/api/v1/security/explain', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ object: objectName, operation, recordIds: chunk }),
            });
            if (!res.ok) continue; // 401 / 403 / 501 → fail open
            const decision: unknown = await res.json();
            const records = (decision as { records?: unknown } | null)?.records;
            if (!Array.isArray(records)) continue; // no batch verdict → fail open
            // Ordering IS the contract: `records[i]` answers `recordIds[i]`.
            // The echoed `recordId` is checked, not trusted as the key — a
            // response that disagrees with its own ordering contract is not a
            // response this hook can safely re-key, so the entry is dropped and
            // that row falls back to the object-level answer.
            chunk.forEach((id, index) => {
              const entry = records[index] as WireRecordVerdict | undefined;
              if (!entry || typeof entry.visible !== 'boolean') return;
              if (typeof entry.recordId === 'string' && entry.recordId !== id) return;
              verdictCache.set(cacheKey(objectName, id, operation), entry.visible);
            });
          } catch {
            /* network / parse failure → fail open */
          }
        }
      }));
      if (!cancelled) publish();
    })();

    // Rows already in the cache answer on this render rather than after the
    // round trip — paging back to a visited page never blinks through the
    // fail-open state.
    publish();

    return () => {
      cancelled = true;
    };
  }, [objectName, ids, wantUpdate, wantDelete, apiFetch]);

  return React.useMemo<RecordCrudVerdictLookup>(() => {
    if (verdicts.size === 0) return NO_VERDICTS;
    return (recordId, operation) =>
      recordId == null ? undefined : verdicts.get(`${operation}:${String(recordId)}`);
  }, [verdicts]);
}
