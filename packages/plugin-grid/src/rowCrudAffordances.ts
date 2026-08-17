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
 *     (`resolveEffectiveCrudAffordances` in `@object-ui/core`). It folds three layers:
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
 * and on top of that verdict:
 *
 *       d. [#4096] the CURRENT PRINCIPAL's effective permission on the object
 *          (`/me/permissions` `allowEdit` / `allowDelete`, reached through
 *          `usePermissions().can(obj, 'update' | 'delete')`) — passed in as
 *          `permissionUpdate` / `permissionDelete`.
 *
 * Layer (c) and layer (d) answer DIFFERENT questions and neither substitutes
 * for the other. `apiOperations` is the object's API EXPOSURE SURFACE — "which
 * verbs does this object publish at all" — and is principal-independent: two
 * accounts with opposite write grants receive a byte-identical set (measured in
 * #4096: 30/30 shared objects identical between an account with `allowEdit`
 * and one without). Intersecting only with (c) therefore fails OPEN for every
 * unprivileged account. Layer (d) is the per-principal verdict the toolbar's
 * `affordances.create && can(obj, 'create')` and the record header's
 * `objectAffordances.edit && recordWriteAllowed` already AND in; the row kebab
 * and the bulk-delete bar now run the same judgement, so one screen no longer
 * carries three different answers to "may this user write this object".
 *
 * Every layer is an INTERSECTION, never a union: a server grant cannot re-open
 * what the bucket or `userActions` closed, a `userActions` opt-in cannot
 * survive a server denial, and neither can survive a permission denial. An
 * absent effective set (unrestricted object / old backend / no
 * `PermissionProvider`) leaves the bucket verdict untouched, an absent
 * `permissionUpdate` / `permissionDelete` likewise leaves it untouched — the
 * no-provider host keeps today's behavior, because `usePermissions()` without a
 * `PermissionProvider` answers `can: () => true` by design (standalone embeds
 * have no permission source and must not lose their Edit/Delete) — and an
 * absent `managedBy` resolves to the `platform` bucket, so every main list on
 * an ordinary object keeps its Edit/Delete kebab out of the box.
 *
 * Since objectui#2614, `userActions.edit` / `delete` also accept an object
 * form `{ enabled?, visibleWhen?, disabledWhen? }`: `enabled` carries the
 * boolean opt-out, and the two CEL predicates gate the affordance
 * **per record**. The predicates are returned untouched as
 * `editPredicates` / `deletePredicates` for the row renderer to evaluate
 * (they never affect the object-level `canEdit` / `canDelete` verdict).
 *
 * On top of all of the above sits one more layer, applied PER ROW rather than
 * per object and therefore resolved by {@link resolveRowRecordCrudAffordance}
 * rather than here:
 *
 *       e. [#4296] the RECORD-level verdict — the explain engine's answer for
 *          this one row (`security/explain` with `recordIds`, batched per page
 *          by `./hooks/useRecordCrudVerdicts`).
 *
 * Layers (d) and (e) answer different questions for the same reason (c) and (d)
 * do. `allowEdit` is the principal's verdict on the OBJECT; `writeScope`, the
 * sharing model and RLS narrow it per row, so layer (d) fails OPEN for every
 * record the principal does not own — a user with a legitimately broad object
 * grant saw Edit/Delete on every row they could read, and the server answered
 * 403 on the ones it does not own. The record detail header has ANDed the
 * record-level verdict since objectstack#3821; the row kebab now runs the same
 * judgement against the same engine, so one screen no longer carries two
 * opposite answers to "may this user write THIS record".
 */

import { resolveEffectiveCrudAffordances, type RowCrudPredicates, type UserActionOverride } from '@object-ui/core';

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
  /**
   * [#4096] The current principal's effective `update` permission on this
   * object — `usePermissions().can(objectName, 'update')`, which
   * `MePermissionsProvider` maps to `/me/permissions` `allowEdit`.
   *
   * `undefined` (no object name resolved, caller that has not wired the check)
   * leaves the verdict untouched, exactly like `effectiveApiOperations`. Note
   * that "no `PermissionProvider`" does NOT arrive here as `undefined`: the
   * hook's provider-less fallback answers `true`, which is the same
   * no-narrowing outcome.
   */
  permissionUpdate?: boolean;
  /**
   * [#4096] The current principal's effective `delete` permission on this
   * object — `usePermissions().can(objectName, 'delete')` → `allowDelete`.
   * Same `undefined` semantics as `permissionUpdate`.
   */
  permissionDelete?: boolean;
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
  const aff = resolveEffectiveCrudAffordances(
    { managedBy: opts.managedBy, userActions: opts.userActions },
    opts.effectiveApiOperations,
  );
  // [#4096] …then the principal's own verdict. `apiOperations` above is the
  // object's exposure surface and says nothing about WHO is asking, so without
  // this the row kebab fails open for every account with no write grant.
  const objectCanEdit = aff.edit && opts.permissionUpdate !== false;
  const objectCanDelete = aff.delete && opts.permissionDelete !== false;
  const canEdit =
    !!((opts.operationsUpdate || opts.wantEditAction) && opts.hasOnEdit) && objectCanEdit;
  const canDelete =
    !!((opts.operationsDelete || opts.wantDeleteAction) && opts.hasOnDelete) && objectCanDelete;
  return {
    canEdit,
    canDelete,
    objectCanDelete,
    editPredicates: canEdit ? aff.editPredicates : undefined,
    deletePredicates: canDelete ? aff.deletePredicates : undefined,
  };
}

/**
 * [#4296] Layer (e): narrow ONE row's Edit/Delete affordance by the
 * RECORD-level verdict, on top of the object-level answer this module's
 * {@link resolveRowCrudAffordances} resolved.
 *
 * An INTERSECTION like every layer above it: a record-level grant cannot
 * re-open what the bucket, `userActions`, the effective operation set or the
 * principal's object permission closed. It only ever removes.
 *
 * `recordVerdict === undefined` means the record-grained answer is UNKNOWN —
 * the batch verdict has not arrived yet, the endpoint failed or is absent, the
 * row carries no id, or the response did not answer this row. Unknown leaves
 * the object verdict untouched, i.e. renders exactly what this list rendered
 * before layer (e) existed. That direction is deliberate and pinned: the server
 * is the authority and already fail-closes with a 403, so an over-hidden row
 * would cost a permitted user a capability they have, which is strictly worse
 * than the wasted click this layer removes. It is the same `!== false` posture
 * layer (d) takes for an absent `permissionUpdate` / `permissionDelete`, and
 * the same fail-open posture `useRecordEditable` takes on the detail header.
 *
 * @param objectVerdict `canEdit` / `canDelete` for the object, from
 *   {@link resolveRowCrudAffordances}.
 * @param recordVerdict this row's `decision.records[i].visible`, or `undefined`
 *   when no record-grained answer is available for it.
 */
export function resolveRowRecordCrudAffordance(
  objectVerdict: boolean | undefined,
  recordVerdict: boolean | undefined,
): boolean {
  return !!objectVerdict && recordVerdict !== false;
}
