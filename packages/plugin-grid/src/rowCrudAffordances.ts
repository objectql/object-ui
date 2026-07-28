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
 *  2. The OBJECT's resolved CRUD affordance — the SAME shared policy the
 *     toolbar, the record header, the form and the related lists run
 *     (`resolveCrudAffordances` in `@object-ui/core`). It folds three layers:
 *
 *       a. the ADR-0103 lifecycle bucket (`managedBy`) — engine-owned
 *          `system` / `append-only` / `better-auth` objects default their
 *          generic edit/delete OFF;
 *       b. the object's `userActions.edit` / `userActions.delete` overrides,
 *          which both opt a bucket-locked object back IN and opt a `platform`
 *          object OUT — the latter typically because it ships dedicated
 *          actions instead (e.g. `sys_environment` replaces generic edit with
 *          a `Rename` action and generic delete with a cascade-teardown
 *          `Delete` action, and the generic entries would otherwise render a
 *          confusing duplicate);
 *       c. [#3720] the SERVER's effective API operation set for the object
 *          (`/me/permissions` `apiOperations`, #3391) — `edit` is ANDed with
 *          `update` and `delete` with `delete`, so a row never offers a
 *          mutation the server would reject.
 *
 * Layer (c) is an INTERSECTION, never a union: a server grant cannot re-open
 * what the bucket or `userActions` closed, and a `userActions` opt-in cannot
 * survive a server denial. An absent effective set (unrestricted object / old
 * backend / no `PermissionProvider`) leaves the bucket verdict untouched, and
 * an absent `managedBy` resolves to the `platform` bucket — so every main list
 * on an ordinary object keeps its Edit/Delete kebab out of the box.
 *
 * Since objectui#2614, `userActions.edit` / `delete` also accept an object
 * form `{ enabled?, visibleWhen?, disabledWhen? }`: `enabled` carries the
 * boolean opt-out, and the two CEL predicates gate the affordance
 * **per record**. The predicates are returned untouched as
 * `editPredicates` / `deletePredicates` for the row renderer to evaluate
 * (they never affect the object-level `canEdit` / `canDelete` verdict).
 */

import { resolveCrudAffordances, type RowCrudPredicates, type UserActionOverride } from '@object-ui/core';

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
  /** The object's ADR-0103 lifecycle bucket; absent → the `platform` default. */
  managedBy?: string | null;
  /** The object's `userActions` block ({ create, edit, delete, import }). */
  userActions?: { edit?: RowCrudUserAction; delete?: RowCrudUserAction } | null;
  /**
   * [#3720] The server-resolved effective API operation set for this object
   * (`/me/permissions` `apiOperations`, #3391). `undefined` / `null` (old
   * backend, unrestricted object, no provider) leaves the object verdict
   * untouched; an empty array means "expose nothing" → both entries hidden.
   */
  effectiveApiOperations?: readonly string[] | null;
}): {
  canEdit: boolean;
  canDelete: boolean;
  /**
   * The OBJECT-level delete verdict, independent of the row `onDelete`
   * wiring. BULK delete rides a different callback (`onBulkDelete`), so it
   * gates on this rather than on `canDelete` — otherwise a consumer that
   * wires only the bulk handler would be judged by whether the *row* handler
   * happens to be present.
   */
  objectCanDelete: boolean;
  editPredicates?: RowCrudPredicates;
  deletePredicates?: RowCrudPredicates;
} {
  // The object-level verdict comes from the shared policy — bucket default,
  // `userActions` override, then the server's effective operation set. The row
  // gate is that verdict AND the consumer having actually wired the affordance.
  const aff = resolveCrudAffordances(
    { managedBy: opts.managedBy, userActions: opts.userActions },
    opts.effectiveApiOperations,
  );
  const canEdit =
    !!((opts.operationsUpdate || opts.wantEditAction) && opts.hasOnEdit) && aff.edit;
  const canDelete =
    !!((opts.operationsDelete || opts.wantDeleteAction) && opts.hasOnDelete) && aff.delete;
  return {
    canEdit,
    canDelete,
    objectCanDelete: aff.delete,
    editPredicates: canEdit ? aff.editPredicates : undefined,
    deletePredicates: canDelete ? aff.deletePredicates : undefined,
  };
}
