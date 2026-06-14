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
 */
export function resolveRowCrudAffordances(opts: {
  operationsUpdate?: boolean;
  operationsDelete?: boolean;
  wantEditAction?: boolean;
  wantDeleteAction?: boolean;
  hasOnEdit?: boolean;
  hasOnDelete?: boolean;
  /** The object's `userActions` block ({ create, edit, delete, import }). */
  userActions?: { edit?: boolean; delete?: boolean } | null;
}): { canEdit: boolean; canDelete: boolean } {
  const editOptedOut = opts.userActions?.edit === false;
  const deleteOptedOut = opts.userActions?.delete === false;
  const canEdit =
    !!((opts.operationsUpdate || opts.wantEditAction) && opts.hasOnEdit) && !editOptedOut;
  const canDelete =
    !!((opts.operationsDelete || opts.wantDeleteAction) && opts.hasOnDelete) && !deleteOptedOut;
  return { canEdit, canDelete };
}
