/**
 * crudAffordances — UI-side mirror of the framework's
 * `resolveCrudAffordances()` helper (see
 * `@objectstack/spec/data/object.zod.ts`).
 *
 * The framework tags every object with a `managedBy` lifecycle bucket
 * (`platform | config | system | append-only | better-auth`) and an
 * optional `userActions` override block. UI components ask this helper
 * "should I show the New / Import / Edit / Delete / Export buttons?" so
 * the toolbar tracks the object's lifecycle automatically — no need for
 * each view to special-case `sys_*` names.
 *
 * Keep this in lockstep with the framework helper. The bucket defaults
 * mirror what Salesforce / ServiceNow / Workday / Notion do for the
 * equivalent categories of system tables.
 */

export type ManagedByBucket =
  | 'platform'
  | 'config'
  | 'system'
  | 'append-only'
  | 'better-auth';

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
   * (objectui#2614). Carried through as authored (bare CEL string or
   * `{ dialect, source }` envelope) for row renderers to evaluate via
   * `useRowPredicate`; they never affect the object-level booleans above.
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

const DEFAULTS: Record<ManagedByBucket, CrudAffordances> = {
  platform:      { create: true,  import: true,  edit: true,  delete: true,  exportCsv: true },
  config:        { create: true,  import: false, edit: true,  delete: true,  exportCsv: true },
  system:        { create: false, import: false, edit: false, delete: false, exportCsv: true },
  'append-only': { create: false, import: false, edit: false, delete: false, exportCsv: true },
  'better-auth': { create: false, import: false, edit: false, delete: false, exportCsv: true },
};

export interface SchemaLike {
  managedBy?: string | null;
  userActions?: UserActionsOverride | null;
}

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
