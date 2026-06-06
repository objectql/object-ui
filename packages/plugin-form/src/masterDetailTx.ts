/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Pure helpers for the master-detail (parent + line items) client-orchestrated
 * write. Kept free of React so the transaction logic is unit-testable in
 * isolation (see ADR-0001). Both <MasterDetailForm> and <LineItemsPanel>
 * delegate their child persistence here.
 */

import type { DataSource } from '@object-ui/types';

export const idOf = (rec: any): string | undefined =>
  rec == null ? undefined : (rec.id ?? rec._id ?? rec.recordId);

export interface RowDiff {
  toCreate: Record<string, any>[];
  toUpdate: Record<string, any>[];
  toDelete: string[];
}

/**
 * Diff the current rows against a loaded snapshot. Rows without an id are
 * creates; rows with an id are updates; snapshot ids no longer present are
 * deletes.
 */
export interface BatchDetailInput {
  childObject: string;
  relationshipField: string;
  rows: Record<string, any>[];
}

/** Edit-mode detail input: current rows + the loaded snapshot to diff against. */
export interface BatchEditDetailInput extends BatchDetailInput {
  original: Record<string, any>[];
}

export interface BatchOp {
  object: string;
  action: 'create' | 'update' | 'delete';
  /** Present for create/update. */
  data?: Record<string, any>;
  /** Present for update/delete. */
  id?: string;
}

/**
 * Build cross-object batch operations for an ATOMIC master-detail create:
 * the parent at index 0, then each child with its relationship FK set to
 * `{ $ref: 0 }` so the server resolves it to the parent's generated id inside
 * one transaction (commit all or roll back all).
 */
export function buildMasterDetailBatch(
  parentObject: string,
  parentData: Record<string, any>,
  details: BatchDetailInput[],
): BatchOp[] {
  const ops: BatchOp[] = [{ object: parentObject, action: 'create', data: parentData }];
  for (const d of details) {
    for (const row of d.rows) {
      ops.push({ object: d.childObject, action: 'create', data: { ...row, [d.relationshipField]: { $ref: 0 } } });
    }
  }
  return ops;
}

/**
 * Build cross-object batch operations for an ATOMIC master-detail EDIT: update
 * the existing parent (index 0), then per child collection diff the current
 * rows against the loaded snapshot into create / update / delete ops. The
 * parent id is already known, so children reference it directly (no `$ref`).
 * The whole set commits or rolls back as one transaction.
 */
export function buildMasterDetailEditBatch(
  parentObject: string,
  parentId: string,
  parentData: Record<string, any>,
  details: BatchEditDetailInput[],
): BatchOp[] {
  const ops: BatchOp[] = [{ object: parentObject, action: 'update' as const, id: parentId, data: parentData }];
  for (const d of details) {
    const withFk = (d.rows || []).map((r) => ({ ...r, [d.relationshipField]: parentId }));
    const { toCreate, toUpdate, toDelete } = diffRows(d.original || [], withFk);
    for (const row of toCreate) {
      // Strip any client-only id so the server generates one.
      const { id: _omit, _id: _omit2, recordId: _omit3, ...clean } = row as any;
      ops.push({ object: d.childObject, action: 'create', data: clean });
    }
    for (const row of toUpdate) {
      ops.push({ object: d.childObject, action: 'update', id: idOf(row)!, data: row });
    }
    for (const id of toDelete) {
      ops.push({ object: d.childObject, action: 'delete', id });
    }
  }
  return ops;
}

export function diffRows(
  original: Record<string, any>[],
  current: Record<string, any>[],
): RowDiff {
  const currentIds = new Set(current.map(idOf).filter(Boolean) as string[]);
  return {
    toCreate: current.filter((r) => !idOf(r)),
    toUpdate: current.filter((r) => idOf(r)),
    toDelete: (original || [])
      .map(idOf)
      .filter((id): id is string => !!id && !currentIds.has(id)),
  };
}

/** Sum a numeric column across rows (blanks/NaN ignored). */
export function sumRows(rows: Record<string, any>[], field: string): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, r) => {
    const v = Number(r?.[field]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

/**
 * Normalize whatever a create/bulk call resolves to into an array of records.
 * Adapters vary: some return `T[]`, others `{ records: [...] }` / `{ data: [...] }`
 * or a single record. We only use the result to collect ids for cleanup, so a
 * best-effort coercion keeps the happy path from throwing on an odd shape.
 */
function toRecordArray(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  if (res && Array.isArray(res.data)) return res.data;
  if (res && (res.id || res._id)) return [res];
  return [];
}

/** Create child rows, preferring a single bulk call when the adapter has one. */
async function createMany(
  dataSource: DataSource,
  childObject: string,
  rows: Record<string, any>[],
): Promise<any[]> {
  if (rows.length === 0) return [];
  if (typeof dataSource.bulk === 'function') {
    return toRecordArray(await dataSource.bulk(childObject, 'create', rows));
  }
  const created = await Promise.all(rows.map((r) => dataSource.create(childObject, r)));
  return toRecordArray(created);
}

export interface ApplyDetailOptions {
  childObject: string;
  relationshipField: string;
  rows: Record<string, any>[];
  /** Loaded snapshot — when present we diff (edit mode); otherwise create-all. */
  original?: Record<string, any>[];
  /** Numeric child column to sum. */
  amountField?: string;
  /** Parent field to receive the rolled-up sum. */
  totalField?: string;
}

export interface ApplyDetailResult {
  /** Child object + id pairs created in this call (for cleanup on failure). */
  created: Array<{ object: string; id: string }>;
}

/**
 * Persist one child collection for a known parent id. Sets the relationship FK
 * on every row, then creates / updates / deletes, then (optionally) rolls the
 * line total up onto the parent. Hooks can't do nested writes, so the rollup
 * happens here on the client.
 */
export async function applyDetail(
  dataSource: DataSource,
  parentObject: string,
  parentId: string,
  opts: ApplyDetailOptions,
): Promise<ApplyDetailResult> {
  const created: Array<{ object: string; id: string }> = [];
  const withFk = opts.rows.map((r) => ({ ...r, [opts.relationshipField]: parentId }));

  if (opts.original !== undefined) {
    const { toCreate, toUpdate, toDelete } = diffRows(opts.original, withFk);
    const newRecords = await createMany(dataSource, opts.childObject, toCreate);
    for (const rec of newRecords) {
      const id = idOf(rec);
      if (id) created.push({ object: opts.childObject, id });
    }
    await Promise.all(toUpdate.map((r) => dataSource.update(opts.childObject, idOf(r)!, r)));
    await Promise.all(toDelete.map((id) => dataSource.delete(opts.childObject, id)));
  } else {
    const newRecords = await createMany(dataSource, opts.childObject, withFk);
    for (const rec of newRecords) {
      const id = idOf(rec);
      if (id) created.push({ object: opts.childObject, id });
    }
  }

  if (opts.totalField) {
    const total = sumRows(opts.rows, opts.amountField || 'amount');
    await dataSource.update(parentObject, parentId, { [opts.totalField]: total });
  }

  return { created };
}
