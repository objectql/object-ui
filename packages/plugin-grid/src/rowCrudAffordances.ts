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

import { normalizeUserAction, type RowCrudPredicates, type UserActionOverride } from '@object-ui/core';

// The `userActions.{edit,delete}` override shape (bare boolean or #2614 object
// form) and its per-record predicates are parsed in exactly one place —
// `@object-ui/core`'s `normalizeUserAction`. Re-exported under the historical
// names so existing `./rowCrudAffordances` importers keep resolving.
export type { RowCrudPredicates } from '@object-ui/core';
/** A `userActions.edit` / `delete` flag: bare boolean or the #2614 object form. */
export type RowCrudUserAction = UserActionOverride;

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
  // Opt-out model (base = true): the generic Edit/Delete surface UNLESS the
  // object explicitly disabled the flag (`false` / `{ enabled: false }`). The
  // bucket-level lock is applied upstream via the view's `operations.*`.
  const edit = normalizeUserAction(opts.userActions?.edit, true);
  const del = normalizeUserAction(opts.userActions?.delete, true);
  const canEdit =
    !!((opts.operationsUpdate || opts.wantEditAction) && opts.hasOnEdit) && edit.enabled;
  const canDelete =
    !!((opts.operationsDelete || opts.wantDeleteAction) && opts.hasOnDelete) && del.enabled;
  return {
    canEdit,
    canDelete,
    editPredicates: canEdit ? edit.predicates : undefined,
    deletePredicates: canDelete ? del.predicates : undefined,
  };
}
