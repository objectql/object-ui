/**
 * Resolvers for record-form navigation targets.
 *
 * Pure helpers extracted from `AppContent.tsx` so the routing rules behind
 * the modal-vs-page decision are unit-testable in isolation. Keep this file
 * free of React / router imports — it must run in a node test environment.
 *
 * @module utils/recordFormNavigation
 */

/**
 * Subset of the object metadata shape consumed by the resolver. Mirrors the
 * fields read from the runtime objects list (`useMetadata().objects`).
 */
export interface ObjectDefinitionForNavigation {
  /** API name used in URLs. */
  name: string;
  /** Optional UI mode override for create/edit interactions. */
  editMode?: 'modal' | 'page';
}

/**
 * Result of the modal-vs-page decision. `kind: 'modal'` means the caller
 * should open the global `<ModalForm>`; `kind: 'page'` means the caller
 * should `navigate(url)` to the full-screen create/edit route.
 */
export type RecordFormTarget =
  | { kind: 'modal' }
  | { kind: 'page'; url: string };

/**
 * Build a record-form navigation target.
 *
 * Returns:
 *   - `{ kind: 'modal' }` when the object metadata does not opt in to page
 *     mode (default behavior — preserves backward compatibility).
 *   - `{ kind: 'page', url }` when `objectDef.editMode === 'page'`. The
 *     URL points at `/{baseUrl}/{objectName}/new` for create, or
 *     `/{baseUrl}/{objectName}/record/{recordId}/edit` for edit. The
 *     `recordId` is derived from `record.id` or `record._id`, falling
 *     back to create-mode if neither is present.
 *
 * Notes:
 *   - Returns `{ kind: 'modal' }` when `objectDef` is missing or has no
 *     `name` — the caller (AppContent) treats this as "no actionable
 *     state" and falls back to the existing modal flow.
 *   - `recordId` is URL-encoded so non-ASCII / reserved characters in
 *     object IDs (e.g. UUIDs with `:` separators) are safe.
 */
export function resolveRecordFormTarget(opts: {
  objectDef: ObjectDefinitionForNavigation | null | undefined;
  baseUrl: string;
  record: { id?: string | number; _id?: string | number } | null | undefined;
}): RecordFormTarget {
  const { objectDef, baseUrl, record } = opts;

  if (!objectDef?.name || objectDef.editMode !== 'page') {
    return { kind: 'modal' };
  }

  const rawId = record?.id ?? record?._id;
  if (record && rawId != null && rawId !== '') {
    const encoded = encodeURIComponent(String(rawId));
    return {
      kind: 'page',
      url: `${baseUrl}/${objectDef.name}/record/${encoded}/edit`,
    };
  }

  return { kind: 'page', url: `${baseUrl}/${objectDef.name}/new` };
}

/**
 * Subset of the default form-view shape consumed by
 * {@link resolveFormViewLayout}. This is the flattened `config` body of the
 * object's default `viewKind: 'form'` ViewItem (ADR-0017), merged onto the
 * object by `MetadataProvider` as `objectDef.form` (and mirrored under
 * `objectDef.formViews.default` for the legacy aggregated-container shape).
 */
export interface FormViewDefinition {
  /**
   * Layout family declared by the form view (`simple` | `tabbed` | `wizard`
   * | `split`). Only `tabbed` changes the *modal's* internal layout; the
   * others still render their curated sections, just stacked.
   */
  type?: string;
  /** Curated field sections — the selection, order, and grouping to render. */
  sections?: any[];
  /** Inline child collections (master-detail). */
  subforms?: any[];
}

/**
 * Object metadata subset carrying the default form view, as merged onto the
 * runtime objects list (`useMetadata().objects`).
 */
export interface ObjectDefinitionForFormView {
  form?: FormViewDefinition | null;
  formViews?: { default?: FormViewDefinition | null } | null;
}

/**
 * Layout props derived from an object's default form view, ready to spread
 * into a `<ModalForm>` schema.
 */
export interface FormViewModalLayout {
  /** Curated sections to render (omitted when the form view declares none). */
  sections?: any[];
  /** `'tabbed'` when the form view is tabbed; omitted otherwise (stacked). */
  contentLayout?: 'tabbed';
  /** Inline child collections for a master-detail modal. */
  subforms?: any[];
}

/**
 * Resolve a `<ModalForm>`'s layout props from an object's DEFAULT FORM VIEW
 * (curated sections + field selection/order, plus master-detail subforms).
 *
 * The create / edit record modal otherwise falls back to the raw object
 * schema — rendering every field in schema order and ignoring the curated
 * form view entirely. This resolver lets the New/Edit modal honor the same
 * view-driven layout the full-screen record page (`RecordFormPage`) does.
 *
 * Resolution mirrors `RecordFormPage`: prefer `objectDef.form` (the default
 * ViewItem) and fall back to `objectDef.formViews.default` (legacy container).
 *
 * Returns an EMPTY object when the object has no form view, or a form view
 * that declares no sections — the caller then keeps its existing behavior
 * (a flat field list, i.e. the raw object schema). Empty `sections` /
 * `subforms` arrays are treated as absent so an empty curation never blanks
 * out the form.
 */
export function resolveFormViewLayout(
  objectDef: ObjectDefinitionForFormView | null | undefined,
): FormViewModalLayout {
  const formView = objectDef?.form ?? objectDef?.formViews?.default;
  if (!formView) return {};

  const layout: FormViewModalLayout = {};

  if (Array.isArray(formView.sections) && formView.sections.length > 0) {
    layout.sections = formView.sections;
    // Only 'tabbed' maps to a modal content layout; 'wizard'/'split' have no
    // modal equivalent and degrade to a stacked section list.
    if (formView.type === 'tabbed') layout.contentLayout = 'tabbed';
  }

  if (Array.isArray(formView.subforms) && formView.subforms.length > 0) {
    layout.subforms = formView.subforms;
  }

  return layout;
}

/**
 * Result of the post-create-save navigation decision (#2604 save invariant:
 * *create takes you to the record you made*). `kind: 'none'` means stay put
 * (no usable record id came back from the save).
 */
export type PostCreateTarget =
  | { kind: 'none' }
  | { kind: 'detail-page' | 'detail-drawer'; url: string };

/**
 * Decide where a CREATE save lands (#2604): the new record's detail, on the
 * record's own derived surface.
 *
 *   - `surface: 'page'` (field-heavy) → the detail ROUTE
 *     `{baseUrl}/{objectName}/record/{id}` — deep-linkable, and the detail
 *     page's own "← all records" affordance covers the way back.
 *   - `surface: 'drawer'` (light) → the CURRENT list route with
 *     `?recordId={id}` — the detail drawer opens OVER the still-intact list
 *     (ObjectView treats that param as the drawer's source of truth), so the
 *     list context is preserved for free.
 *
 * The `form` overlay param is stripped from the drawer URL so the create
 * overlay does not reopen underneath the drawer. Pure and router-free: the
 * caller derives `surface` (deriveRecordSurface) and performs the navigation
 * (with `replace: true`, so Back skips the transient form state).
 */
export function resolvePostCreateTarget(opts: {
  objectName: string;
  baseUrl: string;
  /** Current location pathname (the list route the create started from). */
  pathname: string;
  /** Current location search (query string, with or without leading `?`). */
  search?: string;
  /** The record's derived VIEW surface (`deriveRecordSurface(objectDef)`). */
  surface: 'page' | 'drawer';
  /** Saved record id (`result.id ?? result._id`). */
  recordId: unknown;
}): PostCreateTarget {
  const { objectName, baseUrl, pathname, search, surface, recordId } = opts;
  if (recordId == null || recordId === '' || !objectName) return { kind: 'none' };
  const encoded = encodeURIComponent(String(recordId));

  if (surface === 'page') {
    return { kind: 'detail-page', url: `${baseUrl}/${objectName}/record/${encoded}` };
  }

  const sp = new URLSearchParams(search ?? '');
  sp.delete('form');
  sp.set('recordId', String(recordId));
  return { kind: 'detail-drawer', url: `${pathname}?${sp.toString()}` };
}

/**
 * Action descriptor accepted by the navigate-create / navigate-edit
 * handlers. Loose-typed because the same shape is constructed dynamically
 * from JSON metadata at runtime and we want the helpers to be tolerant of
 * legacy or hand-authored inputs.
 */
export interface NavigationActionDef {
  /** Optional explicit object name (overrides any context). */
  objectName?: string;
  /** Optional explicit record id (only meaningful for `navigate_edit`). */
  recordId?: string | number;
  /** Standard params bag — preferred location for objectName / recordId. */
  params?: {
    objectName?: string;
    recordId?: string | number;
    [key: string]: any;
  };
}

/**
 * Optional context typically supplied by an `ActionRunner` (e.g. when the
 * action button is mounted inside an `ObjectView`, the view registers its
 * `objectName` and `baseUrl` on the runner so action JSON can omit them).
 *
 * Tolerant of additional unknown keys because the upstream
 * `ActionRunner.getContext()` returns a generic `ActionContext` with an
 * open index signature; we only read the two fields we care about.
 */
export interface NavigationActionContext {
  objectName?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export type NavigationActionResult =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * Resolve the URL for a `navigate_create` action.
 *
 * Order of precedence for `objectName`:
 *   1. `action.params.objectName`
 *   2. `action.objectName`
 *   3. `context.objectName`
 *
 * `baseUrl` falls back to `context.baseUrl`, then to the supplied
 * `defaultBaseUrl` (typically `/apps/{appName}`).
 *
 * Returns `{ success: false }` with a descriptive error when `objectName`
 * cannot be resolved — the caller (`ActionRunner`) surfaces this to the UI.
 */
export function resolveNavigateCreateUrl(opts: {
  action: NavigationActionDef;
  context?: NavigationActionContext;
  defaultBaseUrl: string;
}): NavigationActionResult {
  const { action, context = {}, defaultBaseUrl } = opts;
  const objectName =
    action.params?.objectName ?? action.objectName ?? context.objectName;
  const baseUrl = context.baseUrl ?? defaultBaseUrl;
  if (!objectName) {
    return {
      success: false,
      error: 'navigate_create: objectName is required',
    };
  }
  return { success: true, url: `${baseUrl}/${objectName}/new` };
}

/**
 * Resolve the URL for a `navigate_edit` action.
 *
 * Same `objectName` precedence as {@link resolveNavigateCreateUrl}.
 * `recordId` is read from `action.params.recordId` or `action.recordId`
 * (no context fallback — record ids are intrinsically per-action).
 *
 * Returns `{ success: false }` with a descriptive error when either
 * `objectName` or `recordId` is missing.
 */
export function resolveNavigateEditUrl(opts: {
  action: NavigationActionDef;
  context?: NavigationActionContext;
  defaultBaseUrl: string;
}): NavigationActionResult {
  const { action, context = {}, defaultBaseUrl } = opts;
  const objectName =
    action.params?.objectName ?? action.objectName ?? context.objectName;
  const recordId = action.params?.recordId ?? action.recordId;
  const baseUrl = context.baseUrl ?? defaultBaseUrl;
  if (!objectName || recordId == null || recordId === '') {
    return {
      success: false,
      error: 'navigate_edit: objectName and recordId are required',
    };
  }
  const encoded = encodeURIComponent(String(recordId));
  return {
    success: true,
    url: `${baseUrl}/${objectName}/record/${encoded}/edit`,
  };
}
