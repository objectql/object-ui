/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useRef, useState } from 'react';
import type { BulkActionDef } from '@object-ui/types';
import { RelatedCountStore } from '@object-ui/components';
import { executeBulkBatch } from '@object-ui/core';
import { normalizeMultiValuePatch, type MultiValueFieldDef } from './multiValueFields';

export interface BulkRowError {
  id: string;
  error: string;
}

export interface BulkProgress {
  total: number;
  done: number;
  failed: number;
  inFlight: boolean;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: BulkRowError[];
}

/**
 * Per-row snapshot of pre-mutation field values, captured so an `update`
 * batch can be reversed. Captures only the keys the patch touched (we cannot
 * faithfully undo a `delete` without a soft-delete provider, so the executor
 * skips snapshotting for non-update operations).
 */
export interface BulkSnapshotEntry {
  id: string;
  prev: Record<string, unknown>;
}

export interface BulkExecutorOptions {
  /** ObjectQL resource name (e.g. 'account'). */
  resource: string;
  /**
   * Object-schema `fields` map for `resource`. When provided, patches built
   * from `def.patch` + params are shape-normalized before hitting the data
   * source: a lone scalar aimed at a multi-value field (multiselect / tags /
   * checkboxes, or select / lookup / user / file / image with
   * `multiple: true`) is wrapped into a single-element array (#2204).
   */
  objectFields?: Record<string, MultiValueFieldDef>;
  /**
   * Minimal data-source surface required by the executor. Matches the public
   * shape of `@object-ui/data-objectstack`'s DataSource without importing it,
   * so consumers can inject any compatible adapter.
   */
  dataSource: {
    update: (resource: string, id: string, patch: Record<string, unknown>) => Promise<unknown>;
    delete: (resource: string, id: string) => Promise<unknown>;
    /**
     * Optional server-side bulk-update primitive. When present, the executor
     * collapses an entire `update` batch into a single HTTP request — turning
     * "mark 500 notifications read" from 500 PATCH calls into 1. Adapters
     * without bulk support keep working via the per-row fallback below.
     */
    bulkUpdate?: (
      resource: string,
      ids: ReadonlyArray<string | number>,
      patch: Record<string, unknown>,
    ) => Promise<number>;
    /**
     * Optional server-side bulk-delete primitive. Symmetric to bulkUpdate.
     */
    bulkDelete?: (
      resource: string,
      ids: ReadonlyArray<string | number>,
    ) => Promise<number>;
  };
}

/**
 * Sequential executor for bulk actions. Iterates the selected records in
 * configurable batches. For `update` operations the hook prefers the
 * adapter's `bulkUpdate` primitive (one HTTP request per batch); when it's
 * absent or throws, it falls back to per-row `dataSource.update`/`delete`
 * via `Promise.allSettled` so a single failure never aborts the run.
 *
 * In addition to running, the hook also exposes:
 *   - `undo()`   — replay the prior values captured during the last update run
 *   - `retry(id)`— re-attempt a single failed row using the last run's params
 *
 * Bulk vs per-row tradeoff:
 * - Bulk halves network round-trips and lets the server enforce atomicity
 *   inside a single transaction (typical "mark all read" use case).
 * - Per-row preserves exact (id, error) attribution for the result CSV.
 * - The hook automatically falls back from bulk to per-row when bulkUpdate
 *   throws, so users still get actionable error detail on hard failures.
 *   Soft (`succeeded < total`) shortfalls surface as a single aggregate
 *   error entry per batch — see comments inline.
 */
export function useBulkExecutor({ resource, dataSource, objectFields }: BulkExecutorOptions) {
  const [progress, setProgress] = useState<BulkProgress>({
    total: 0,
    done: 0,
    failed: 0,
    inFlight: false,
  });
  const [result, setResult] = useState<BulkResult | null>(null);
  // Captured pre-mutation state for the most recent successful update run.
  // We intentionally keep this in a ref so it survives re-renders without
  // forcing the dialog to re-mount its result UI.
  const snapshotRef = useRef<BulkSnapshotEntry[]>([]);
  const lastRunRef = useRef<{
    def: BulkActionDef;
    rows: Array<Record<string, unknown>>;
    params: Record<string, unknown>;
  } | null>(null);

  const reset = useCallback(() => {
    setProgress({ total: 0, done: 0, failed: 0, inFlight: false });
    setResult(null);
    snapshotRef.current = [];
    lastRunRef.current = null;
  }, []);

  const run = useCallback(
    async (
      def: BulkActionDef,
      rows: Array<Record<string, unknown>>,
      params: Record<string, unknown>,
    ): Promise<BulkResult> => {
      const total = rows.length;
      const batchSize = Math.max(1, def.batchSize ?? 200);
      const errors: BulkRowError[] = [];
      let succeeded = 0;
      let failed = 0;

      setResult(null);
      setProgress({ total, done: 0, failed: 0, inFlight: true });

      const buildPatch = (): Record<string, unknown> =>
        normalizeMultiValuePatch({ ...(def.patch ?? {}), ...params }, objectFields);

      // Capture pre-mutation values for keys touched by the patch — only
      // for `update` operations. `delete` is irreversible from the client,
      // and `custom` actions don't necessarily mutate the record itself.
      const snapshot: BulkSnapshotEntry[] = [];
      if (def.operation === 'update') {
        const patchKeys = Object.keys(buildPatch());
        for (const row of rows) {
          const id = String(row.id ?? '');
          if (!id) continue;
          const prev: Record<string, unknown> = {};
          for (const k of patchKeys) {
            prev[k] = (row as Record<string, unknown>)[k];
          }
          snapshot.push({ id, prev });
        }
      }

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        // Collect ids up-front so both bulk and per-row paths share the
        // same id list (and the same "missing id" failures).
        const validIds: string[] = [];
        for (let k = 0; k < batch.length; k += 1) {
          const id = batch[k].id != null ? String(batch[k].id) : '';
          if (id) {
            validIds.push(id);
          } else {
            failed += 1;
            errors.push({ id: `index_${i + k}`, error: 'Missing record id' });
          }
        }

        if (validIds.length === 0) {
          setProgress({ total, done: succeeded, failed, inFlight: true });
          continue;
        }

        // Decide whether the adapter can collapse this whole batch into 1
        // call. Single-row batches skip bulk (no win, just overhead).
        const allowBulk = validIds.length >= 2;
        let bulkCall: ((ids: string[]) => Promise<number>) | undefined;
        let label = 'bulk';
        if (def.operation === 'update' && typeof dataSource.bulkUpdate === 'function') {
          bulkCall = (ids) => dataSource.bulkUpdate!(resource, ids, buildPatch());
          label = 'bulk update';
        } else if (def.operation === 'delete' && typeof dataSource.bulkDelete === 'function') {
          bulkCall = (ids) => dataSource.bulkDelete!(resource, ids);
          label = 'bulk delete';
        }

        const perRow = (id: string): Promise<unknown> => {
          switch (def.operation) {
            case 'delete':
              return dataSource.delete(resource, id);
            case 'update':
              return dataSource.update(resource, id, buildPatch());
            case 'custom':
              // No mutation — caller wires onComplete events for callouts.
              return Promise.resolve();
            default:
              return Promise.reject(new Error(`Unknown operation: ${def.operation}`));
          }
        };

        const outcome = await executeBulkBatch(
          { ids: validIds, originalSize: batch.length, offset: i, allowBulk, label },
          { bulkCall, perRow },
        );
        succeeded += outcome.succeeded;
        failed += outcome.failed;
        errors.push(...outcome.errors);
        setProgress({ total, done: succeeded, failed, inFlight: true });
      }

      const finalResult: BulkResult = { total, succeeded, failed, errors };
      // Only retain the snapshot for rows that actually succeeded — there's
      // no point trying to "undo" a row whose mutation never landed.
      const failedIds = new Set(errors.map(e => e.id));
      snapshotRef.current = snapshot.filter(s => !failedIds.has(s.id));
      lastRunRef.current = { def, rows, params };
      setProgress({ total, done: succeeded, failed, inFlight: false });
      setResult(finalResult);
      // Mutating any row in `resource` may have changed how many records
      // belong to a parent (e.g. deleting Contacts under an Account). Drop
      // every cached count for this resource so the next page render
      // re-probes. Cheap — counts are 1-int values.
      if (succeeded > 0) {
        RelatedCountStore.invalidate(resource);
      }
      return finalResult;
    },
    [resource, dataSource, objectFields],
  );

  /**
   * Reverse the most recent `update` run by replaying each captured snapshot
   * back through `dataSource.update`. No-op (returns null) when the last run
   * was a delete/custom operation or when no successful rows were recorded.
   */
  const undo = useCallback(async (): Promise<BulkResult | null> => {
    const snapshot = snapshotRef.current;
    if (!snapshot.length) return null;
    const total = snapshot.length;
    const errors: BulkRowError[] = [];
    let succeeded = 0;
    let failed = 0;

    setResult(null);
    setProgress({ total, done: 0, failed: 0, inFlight: true });

    const settled = await Promise.allSettled(
      snapshot.map(entry => dataSource.update(resource, entry.id, entry.prev)),
    );
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled') succeeded += 1;
      else {
        failed += 1;
        errors.push({
          id: snapshot[idx].id,
          error: res.reason instanceof Error ? res.reason.message : String(res.reason),
        });
      }
    });

    const undoResult: BulkResult = { total, succeeded, failed, errors };
    // Clear the snapshot — undoing twice would re-apply the old values
    // against rows that have already been reverted, which is rarely useful
    // and easy to do by accident from a sticky toast.
    snapshotRef.current = [];
    setProgress({ total, done: succeeded, failed, inFlight: false });
    setResult(undoResult);
    return undoResult;
  }, [resource, dataSource]);

  /**
   * Re-attempt a single previously-failed row using the same operation +
   * params as the original run. Returns true on success.
   */
  const retry = useCallback(
    async (rowId: string): Promise<boolean> => {
      const last = lastRunRef.current;
      if (!last) return false;
      const row = last.rows.find(r => String(r.id ?? '') === rowId);
      if (!row) return false;
      const patch = normalizeMultiValuePatch(
        { ...(last.def.patch ?? {}), ...last.params },
        objectFields,
      );
      try {
        switch (last.def.operation) {
          case 'delete':
            await dataSource.delete(resource, rowId);
            break;
          case 'update':
            await dataSource.update(resource, rowId, patch);
            break;
          case 'custom':
            return true;
          default:
            return false;
        }
        // Drop this row from the result's errors list — caller updates the
        // outer result so the UI reflects the new state.
        setResult(prev => {
          if (!prev) return prev;
          const errors = prev.errors.filter(e => e.id !== rowId);
          return {
            ...prev,
            errors,
            succeeded: prev.succeeded + 1,
            failed: Math.max(0, prev.failed - 1),
          };
        });
        return true;
      } catch {
        return false;
      }
    },
    [resource, dataSource, objectFields],
  );

  return { run, undo, retry, progress, result, reset };
}
