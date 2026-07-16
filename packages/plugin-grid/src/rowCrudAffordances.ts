/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Resolve whether a list row's kebab should surface the GENERIC Edit / Delete
 * entries.
 *
 * Two inputs decide this:
 *
 *  1. Whether the consumer wired the affordance at all — i.e. the view's
 *     `operations.update` / `operations.delete` (or an explicit `'edit'` /
 *     `'delete'` in `rowActions`) AND an `onEdit` / `onDelete` callback exists.
 *
 *  2. The OBJECT's CRUD affordance flags (`userActions.edit` / `userActions.delete`).
 *     When an object sets these to **`false`** it has deliberately opted out of
 *     the generic row CRUD — typically because it ships dedicated actions
 *     instead (e.g. `sys_environment` replaces generic edit with a `Rename`
 *     action and generic delete with a cascade-teardown `Delete` action). Before
 *     this gate, the generic entries rendered anyway, producing a confusing
 *     duplicate (a generic "Delete" next to the object's own "Delete" action)
 *     and leaking a generic "Edit" the object had turned off.
 *
 * `userActions.edit` / `delete` left `undefined` (or `true`) preserves the
 * out-of-the-box behaviour — every main list keeps its Edit/Delete kebab.
 *
 * Since objectui#2614, `userActions.edit` / `delete` also accept an object
 * form `{ enabled?, visibleWhen?, disabledWhen? }`: `enabled` carries the
 * boolean opt-out, and the two CEL predicates gate the affordance
 * **per record**. The predicates are returned untouched as
 * `editPredicates` / `deletePredicates` for the row renderer to evaluate
 * (they never affect the object-level `canEdit` / `canDelete` verdict).
 */

/** Per-record CEL predicates for a built-in row action (objectui#2614).
 * Kept as authored — bare CEL string or `{ dialect, source }` envelope —
 * and handed to `useRowPredicate` untouched. */
export interface RowCrudPredicates {
  visibleWhen?: unknown;
  disabledWhen?: unknown;
}

/** A `userActions.edit` / `delete` flag: bare boolean or the #2614 object form. */
export type RowCrudUserAction =
  | boolean
  | { enabled?: boolean; visibleWhen?: unknown; disabledWhen?: unknown };

/** Object-level enabled verdict for a userActions flag (undefined = no opt-out). */
function isOptedOut(v: RowCrudUserAction | undefined | null): boolean {
  if (typeof v === 'boolean') return v === false;
  return v?.enabled === false;
}

/** Extract the per-record predicates from the object form, if any. */
function predicatesOf(v: RowCrudUserAction | undefined | null): RowCrudPredicates | undefined {
  if (v == null || typeof v === 'boolean') return undefined;
  if (v.visibleWhen == null && v.disabledWhen == null) return undefined;
  const out: RowCrudPredicates = {};
  if (v.visibleWhen != null) out.visibleWhen = v.visibleWhen;
  if (v.disabledWhen != null) out.disabledWhen = v.disabledWhen;
  return out;
}

export function resolveRowCrudAffordances(opts: {
  operationsUpdate?: boolean;
  operationsDelete?: boolean;
  wantEditAction?: boolean;
  wantDeleteAction?: boolean;
  hasOnEdit?: boolean;
  hasOnDelete?: boolean;
  /** The object's `userActions` block ({ create, edit, delete, import }). */
  userActions?: { edit?: RowCrudUserAction; delete?: RowCrudUserAction } | null;
}): {
  canEdit: boolean;
  canDelete: boolean;
  editPredicates?: RowCrudPredicates;
  deletePredicates?: RowCrudPredicates;
} {
  const editOptedOut = isOptedOut(opts.userActions?.edit);
  const deleteOptedOut = isOptedOut(opts.userActions?.delete);
  const canEdit =
    !!((opts.operationsUpdate || opts.wantEditAction) && opts.hasOnEdit) && !editOptedOut;
  const canDelete =
    !!((opts.operationsDelete || opts.wantDeleteAction) && opts.hasOnDelete) && !deleteOptedOut;
  return {
    canEdit,
    canDelete,
    editPredicates: canEdit ? predicatesOf(opts.userActions?.edit) : undefined,
    deletePredicates: canDelete ? predicatesOf(opts.userActions?.delete) : undefined,
  };
}
