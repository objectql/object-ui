/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Pure helpers that turn a master-detail (parent + line items) edit into a flat
 * list of cross-object batch operations. Kept free of React so the build logic
 * is unit-testable in isolation (see ADR-0001). Both <MasterDetailForm> and
 * <LineItemsPanel> build ops here and hand them to `dataSource.batchTransaction`
 * (via `runBatchTransaction`) — the persistence itself lives in the adapter,
 * not here (ObjectStack objectui #2679).
 */

import type { BatchTransactionOperation } from '@object-ui/types';
import { sanitizeFormData } from './sanitize';

export const idOf = (rec: any): string | undefined =>
  rec == null ? undefined : (rec.id ?? rec._id ?? rec.recordId);

/** Optional child object schema (`{ fields }`) used to strip non-writable
 *  values from a child payload before persisting. */
export type ChildSchema = { fields?: Record<string, any> } | null | undefined;

/**
 * Strip computed / read-only / server-managed / unknown fields from a child
 * row's write payload — the same guard the parent form applies via
 * `sanitizeFormData` (ObjectForm). Child rows are seeded from a full record
 * read (`dataSource.find`), so an edit round-trips computed columns (formula /
 * summary) the grid never let the user edit; the server rejects those as
 * unknown/non-writable fields. Gated on a schema being supplied so existing
 * callers that don't pass one keep their exact behavior (incl. sending `id`
 * inside an update payload). A stored client-computed column
 * (`type: currency` + `expression`, e.g. a line `amount`) is intentionally
 * preserved — only true computed *types* / `readonly` / unknown keys are dropped.
 */
const toWritable = (data: Record<string, any>, childSchema: ChildSchema): Record<string, any> =>
  childSchema ? sanitizeFormData(data, childSchema) : data;

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
  /** When supplied, child write payloads are sanitized against it (drops
   *  computed / read-only / unknown fields). Omit to persist rows as-is. */
  childSchema?: ChildSchema;
}

/** Edit-mode detail input: current rows + the loaded snapshot to diff against. */
export interface BatchEditDetailInput extends BatchDetailInput {
  original: Record<string, any>[];
}

/**
 * @deprecated Use {@link BatchTransactionOperation} from `@object-ui/types`.
 * Retained as a structural alias so existing imports keep compiling. The
 * builders below always set `action`, so the widened (optional-action) alias
 * is a superset that costs nothing at the call sites.
 */
export type BatchOp = BatchTransactionOperation;

const ID_KEYS = new Set(['id', '_id', 'recordId']);

/**
 * A row that carries no user input — every field is blank once the back-
 * reference FK and id keys are set aside. Computed cells (e.g. amount) read
 * null while their inputs are blank, so they don't count as input. Used to
 * drop the always-present trailing "ghost" line (and any row the user cleared)
 * so it never persists as an empty child record.
 */
export function isBlankRow(row: Record<string, any>, relationshipField?: string): boolean {
  if (!row) return true;
  return Object.entries(row).every(([k, v]) => {
    if (k === relationshipField || ID_KEYS.has(k)) return true;
    return v === null || v === undefined || v === '';
  });
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
      if (isBlankRow(row, d.relationshipField)) continue; // skip the ghost/empty line
      // Sanitize business fields, then attach the FK (a schema field, so it
      // survives sanitize anyway — attached explicitly for clarity/safety).
      ops.push({ object: d.childObject, action: 'create', data: { ...toWritable(row, d.childSchema), [d.relationshipField]: { $ref: 0 } } });
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
      if (isBlankRow(row, d.relationshipField)) continue; // skip the ghost/empty line
      // Strip any client-only id so the server generates one.
      const { id: _omit, _id: _omit2, recordId: _omit3, ...clean } = row as any;
      ops.push({ object: d.childObject, action: 'create', data: toWritable(clean, d.childSchema) });
    }
    for (const row of toUpdate) {
      // Route by id; the id is carried separately so sanitize can drop it (and
      // any computed columns) from the data payload without losing the target.
      ops.push({ object: d.childObject, action: 'update', id: idOf(row)!, data: toWritable(row, d.childSchema) });
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

