/**
 * managedBy — the single source of truth for interpreting an object's
 * lifecycle bucket (`ObjectSchema.managedBy`) into CRUD affordances.
 *
 * UI-side mirror of the framework's `resolveCrudAffordances()`
 * (`@objectstack/spec/data/object.zod.ts`, ADR-0103). Lives in `@object-ui/core`
 * — React-free and reachable by every UI package (app-shell, plugin-detail,
 * plugin-form, plugin-grid) — so the bucket logic is defined ONCE instead of
 * hand-mirrored in each. Components ask "should I show New / Import / Edit /
 * Delete / Export?" and get an answer that tracks the object's lifecycle without
 * special-casing `sys_*` names.
 *
 * The bucket UNION type lives in `@object-ui/types` (`ManagedByBucket`) so the
 * schema field can reference it; this module re-exports it for convenience.
 * Only the affordance BOOLEANS live here — all translated copy (badge variants,
 * empty-state messages) stays in `@object-ui/app-shell`.
 */

import type { ManagedByBucket } from '@object-ui/types';

export type { ManagedByBucket } from '@object-ui/types';

export interface CrudAffordances {
  /** Generic "New" button for single-record creation. */
  create: boolean;
  /** CSV bulk-import wizard. */
  import: boolean;
  /** Inline + form editing of existing rows. */
  edit: boolean;
  /** Row-level + bulk delete. */
  delete: boolean;
  /** CSV / clipboard export. */
  exportCsv: boolean;
  /**
   * Per-record CEL predicates for the built-in row Edit/Delete actions,
   * present only when `userActions.edit` / `delete` used the object form
   * (objectui#2614). Carried through as authored for row renderers to evaluate;
   * they never affect the object-level booleans above.
   */
  editPredicates?: RowCrudPredicates;
  deletePredicates?: RowCrudPredicates;
}

/** Per-record predicates from the #2614 object form of a userActions flag. */
export interface RowCrudPredicates {
  visibleWhen?: unknown;
  disabledWhen?: unknown;
}

/** `edit`/`delete` accept a bare boolean or the #2614 object form. */
export type UserActionOverride =
  | boolean
  | { enabled?: boolean; visibleWhen?: unknown; disabledWhen?: unknown };

export interface UserActionsOverride {
  create?: boolean;
  import?: boolean;
  edit?: UserActionOverride;
  delete?: UserActionOverride;
  exportCsv?: boolean;
}

export interface SchemaLike {
  managedBy?: string | null;
  userActions?: UserActionsOverride | null;
}

const DEFAULTS: Record<ManagedByBucket, CrudAffordances> = {
  platform:      { create: true,  import: true,  edit: true,  delete: true,  exportCsv: true },
  config:        { create: true,  import: false, edit: true,  delete: true,  exportCsv: true },
  system:        { create: false, import: false, edit: false, delete: false, exportCsv: true },
  'append-only': { create: false, import: false, edit: false, delete: false, exportCsv: true },
  'better-auth': { create: false, import: false, edit: false, delete: false, exportCsv: true },
};

/**
 * Collapse an `edit`/`delete` override (boolean or #2614 object form) onto
 * the bucket default, surfacing any per-record predicates alongside.
 */
function normalizeOverride(
  v: UserActionOverride | undefined | null,
  base: boolean,
): { enabled: boolean; predicates?: RowCrudPredicates } {
  if (v == null) return { enabled: base };
  if (typeof v === 'boolean') return { enabled: v };
  const enabled = v.enabled ?? base;
  if (v.visibleWhen == null && v.disabledWhen == null) return { enabled };
  const predicates: RowCrudPredicates = {};
  if (v.visibleWhen != null) predicates.visibleWhen = v.visibleWhen;
  if (v.disabledWhen != null) predicates.disabledWhen = v.disabledWhen;
  return { enabled, predicates };
}

/** Resolve the effective CRUD affordances for an object schema. */
export function resolveCrudAffordances(obj: SchemaLike | null | undefined): CrudAffordances {
  const bucket = (obj?.managedBy as ManagedByBucket | undefined) ?? 'platform';
  const base = DEFAULTS[bucket] ?? DEFAULTS.platform;
  const o = obj?.userActions ?? {};
  const edit = normalizeOverride(o.edit, base.edit);
  const del = normalizeOverride(o.delete, base.delete);
  const out: CrudAffordances = {
    create:    o.create    ?? base.create,
    import:    o.import    ?? base.import,
    edit:      edit.enabled,
    delete:    del.enabled,
    exportCsv: o.exportCsv ?? base.exportCsv,
  };
  if (edit.predicates) out.editPredicates = edit.predicates;
  if (del.predicates) out.deletePredicates = del.predicates;
  return out;
}

/** True only when a `userActions` flag (bare boolean or #2614 object form) opts the write in. */
export function isWriteOptedIn(v: UserActionOverride | undefined | null): boolean {
  return v === true || (typeof v === 'object' && v !== null && v.enabled === true);
}

/**
 * ADR-0103 — a `system`-bucket object that opened ANY write via `userActions`
 * is admin/user-writable DATA, not an engine-owned monitoring surface. Used to
 * pick the writable-system badge/empty-state copy.
 */
export function isSystemWritable(obj: SchemaLike | null | undefined): boolean {
  if (obj?.managedBy !== 'system') return false;
  const o = obj?.userActions ?? {};
  return o.create === true || isWriteOptedIn(o.edit) || isWriteOptedIn(o.delete);
}

/**
 * Whether an object's rows may be edited in place (detail inline-edit / form
 * fields) — the resolved `edit` affordance. Engine-owned `system` /
 * `append-only` / `better-auth` objects resolve to `false` unless they opened
 * `userActions.edit`. (Per-record predicates gate row action buttons, not
 * object-level editability, so only the resolved boolean matters here.)
 */
export function isObjectInlineEditable(obj: SchemaLike | null | undefined): boolean {
  return resolveCrudAffordances(obj).edit;
}
