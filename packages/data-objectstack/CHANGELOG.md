# @object-ui/data-objectstack

## 14.1.0

### Patch Changes

- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0

## 14.0.0

### Minor Changes

- 6a74160: Sharing-rule form: pick, don't type. Three new widget-hint field components make
  the generic object form render pickers where an admin previously had to type
  machine data (driven by the framework `widget` hints on `sys_sharing_rule`;
  generalizes the `capability-multiselect` pattern). All degrade to the underlying
  `type` renderer when a widget is unregistered.

  - **`object-ref`** — choose a registered object by name (searchable `Combobox`),
    backed by the new `DataSource.getObjects()` (`ObjectStackAdapter` lists code-
    and DB-defined objects via `/api/v1/meta/object`), falling back to a
    `sys_metadata` query. Stores the object's `name`.
  - **`filter-condition`** — a visual criteria builder (`FilterBuilder`) scoped to
    the fields of the object chosen in a sibling field (via `getObjectSchema`),
    round-tripping the stored **MongoDB-style** FilterCondition JSON. Criteria the
    builder can't represent (or invalid JSON) fall back to a raw-JSON editor, with
    an always-available "Edit as JSON" toggle — nothing is hidden or lost.
  - **`recipient-picker`** — a record picker whose target object follows a sibling
    `recipient_type` (`user`→sys_user, `team`→sys_team, `business_unit`/
    `unit_and_subordinates`→sys_business_unit, `position`→sys_position), storing the
    value the evaluator matches on (a record id, or the position **name**). Resets
    the stored id when the type changes.

  Wiring: the three keys join `DATA_SOURCE_FIELD_TYPES` (form.tsx) so the form
  threads `dataSource` + `dependentValues` to them, and `INLINE_EXCLUDED_FIELD_TYPES`
  (they're authored in the record form, not a grid cell). `DataSource.getObjects()`
  is optional on the interface; the ObjectStack adapter implements it.

### Patch Changes

- Updated dependencies [443360a]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/types@14.0.0

## 13.2.0

### Patch Changes

- e492b9d: Permission sets — pure separation of **design** (Studio) and **assignment**
  (Setup), per ADR-0056 / epic #2398. A `sys_permission_set` used to render its six
  authorization facets in Setup as raw `[Object]` / JSON textareas, and only
  objects+fields were editable in Studio; this reworks both surfaces.

  **Setup (assign + read-only):**
  - The six facets (`object_permissions`, `field_permissions`, `system_permissions`,
    `row_level_security`, `tab_permissions`, `admin_scope`) now render read-only on
    the `sys_permission_set` record page as a compact summary (counts, or capability
    chips) plus a **“Design in Studio →”** deep-link into the structured editor
    (`/apps/:appName/metadata/permission/:setName`, env scope). No `[Object]`, no
    JSON — in the record view, inline edit, and the create/edit form. Implemented as
    a `permission-facet-link` field widget stamped onto the six fields via the single
    `ObjectStackAdapter.getObjectSchema` choke point and honored by DetailSection +
    the record form.
  - User assignment (add/remove via `sys_user_permission_set`) is surfaced directly
    on the Setup record page.

  **Studio (design every facet):** the permission matrix editor gains structured
  editors for the facets that were JSON-only —
  - **System Capabilities**: a multi-select over the live `sys_capability` registry
    (scope-grouped, labelled chips).
  - **Row-Level Security**: per-policy rows (object · operation · enabled) with CEL
    USING/CHECK.
  - **Tab Visibility**: per-tab `visible | hidden | default_on | default_off`.
  - **Delegated Admin Scope**: business-unit + subtree, manage-assignments /
    -bindings / author-env-sets toggles, and an assignable-permission-sets allowlist.
    Assignment was moved out of the editor (it is now a Setup act) — the editor is
    purely a design surface.

  Storage/types are unchanged; editors read/write the draft’s existing parsed
  fields and tolerate legacy JSON strings on load. Note: env-scope metadata saves of
  these facets do not yet project onto the queryable `sys_permission_set` data
  record the Setup summary reads, so a fresh Studio edit isn’t reflected in Setup’s
  read-only view until the projection refreshes — tracked as a framework follow-up
  (enforcement reads the authoritative metadata).
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [619097e]
  - @object-ui/types@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [c31874d]
  - @object-ui/types@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0

## 11.5.0

### Minor Changes

- 1072701: Import wizard: use registered server-side import mappings (framework #2611). When an object has `mapping` metadata artifacts targeting it, the wizard shows a "Saved mapping" selector; picking one hands rename + transforms + write semantics to the server (the artifact is authoritative), replaces the manual column table with a read-only summary of the mapping, and submits `mappingName` over source-header rows (mutually exclusive with the inline column rename). `ImportRequestOptions` gains `mappingName`; the objectstack adapter gains `listImportMappings(objectName)` (feature-detected — the selector simply doesn't appear when unsupported). New `grid.import.*` strings added across all locales.

### Patch Changes

- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- c0164ad: fix(studio): surface spec-validation failures on the field at save/publish

  When a Studio metadata draft failed spec validation, the designer got a single
  opaque banner (and, on a partial publish, a false "published!" toast) — the
  server was already returning field-anchored issues, but the client threw them
  away. Two problems, both fixed:

  - **`parseError` (data-objectstack)** read `String(body.error)`, which yields
    `"[object Object]"` for the dispatcher's object-shaped error, and ignored the
    validation `issues`. It now reads the message from either shape (string or
    `{ message }`) and exposes `MetadataError.issues`, accepting all live server
    shapes — top-level `body.issues` (REST server) and `error.details.issues`
    (HTTP dispatcher).

  - **Studio save/publish (app-shell)** now render those issues **field-anchored**.
    A new `formatMetadataError` helper turns a caught error into one line per
    offending field (`• fields.amount.type — Invalid option: …`); the save banners
    render it with `whitespace-pre-line`. `doPublish` no longer claims success when
    the response carries `data.failed[]` — it lists which drafts failed and why
    (the server returns 200 with the failures buried, so the UI used to swallow
    them). `formatPublishFailures` formats those per-draft.

  Verified end-to-end against a live backend: an invalid object draft returns 422
  with field-anchored issues, and the Studio banner shows
  `• fields.amount.type — Invalid option: expected one of "text"|…` instead of a
  generic message. Unit-tested: `parseError` on the dispatcher shape, and the
  `formatMetadataError` / `formatPublishFailures` helpers.

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [c38d107]
  - @object-ui/types@11.4.0
  - @object-ui/core@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d23d6eb]
  - @object-ui/core@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/core@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/types@11.1.0
- @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/core@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0

## 7.0.0

### Minor Changes

- 30ee761: feat(studio): surface pending drafts on the package detail (ADR-0033)

  After an AI builds an app, its objects/views land as drafts bound to the app package — but Studio's active-only browsers hid them, so the package looked empty and there was no obvious way to find what to review/publish.

  - `MetadataClient.listDrafts({ packageId?, type? })` calls the new `GET /api/v1/meta/_drafts` endpoint, returning pending draft headers (with `packageId`).
  - The package detail sheet (PackagesPage) now shows a **Pending changes** section listing each drafted item, each linking to the existing per-item review/diff (`?review=1`) so the user can publish it. A just-built app package is no longer shown as empty.

- 053c948: feat: ADR-0047 — interface pages, visualization switcher, and Airtable-parity filters

  End-user interface/list pages reach full rendering and authoring parity:

  - **Spec tabs + visualization switcher** — `ObjectView` now forwards
    `viewDef.tabs` (stored/served but never rendered) and `viewDef.appearance`
    (`allowedVisualizations` whitelist), turning on the dormant `ViewSwitcher` when
    more than one type is whitelisted; effective options = author whitelist ∩
    capability-resolvable types (kanban needs `groupBy`, calendar a date field, …).
    `ListView` accepts the canonical `ViewFilterRule[]` tab-filter shape.
  - **User filters** — render only when `userFilters` is explicitly configured;
    selections (dropdown values + active tab) mirror into `uf_*` URL params and
    restore on load, so filtered lists survive reload and are shareable.
  - **Toolbar polish** — the visualization switcher becomes a compact right-side
    "Grid ▾" dropdown inside the tool cluster (no extra row); filter tabs and
    dropdown filters are mutually exclusive.
  - **Studio authoring** — a usable, schema-driven interface-page inspector
    (collapsible sections honoured, array-of-enum → multi-select, a None/Tabs/
    Dropdown `filter-mode` selector where None maps to ABSENCE of `userFilters`),
    and the Design/Preview tabs render the live list via `InterfaceListPage`
    (including a non-empty grid when the source view is hollow).

- 5332639: feat(app-shell): render full object forms (incl. master-detail) in screen-flow wizard steps

  `FlowRunner` now renders an `object-form` screen step: when the paused screen
  carries `kind: 'object-form'`, it mounts the real `<ObjectForm>` for the named
  object (auto-routing to `MasterDetailForm` for inline child collections),
  prefilled from the step's `defaults`. The form persists itself (atomic
  master-detail batch), then resumes the run with the saved record id bound to the
  step's `idVariable`. `dataSource`/`objects` are threaded through all three
  `FlowRunner` mount points.

  Also fixes three pre-existing bugs this surfaced (each affects normal forms too):

  - **plugin-form**: `ObjectForm` now forwards `initialValues`/`initialData` when
    routing to `MasterDetailForm`, so prefilled header values are no longer
    dropped on master-detail create forms.
  - **fields**: `PercentField` treated values as `0–1` fractions (`value × 100`),
    so a `0–100` field (e.g. `probability` default `50`) rendered as `5000%` —
    exceeding `max=100`, which makes HTML5 constraint validation mark the field
    `:invalid` and silently block the whole form's submit. It now treats a field
    declaring `max > 1` as the `0–100` whole-number convention, matching the
    read-side formatter.
  - **data-objectstack**: `ObjectStackAdapter.batchTransaction` now sends
    `credentials: 'include'`, so master-detail batch saves authenticate under the
    console's cookie session (previously every batch save 401'd).

- d16566f: Atomic master-detail create via the cross-object transactional batch endpoint (ObjectStack #1604).

  When the server exposes the transactional batch endpoint, a NEW parent record and its child line items are now persisted in ONE server transaction — commit all or roll back all — instead of the previous client-orchestrated "create parent → create children → best-effort cleanup on failure" sequence.

  **`@object-ui/data-objectstack` — `ObjectStackAdapter.batchTransaction(operations)`**

  - New method posting `{ operations }` to `POST /api/v1/batch`. Operations run in one server transaction. A field value of `{ $ref: <earlier op index> }` resolves to that op's generated id, so a child can reference its parent created earlier in the same batch (master-detail FK). Throws `ObjectStackError('BATCH_ERROR')` on a non-2xx response.

  **`@object-ui/plugin-form`**

  - `MasterDetailForm` now detects `dataSource.batchTransaction` and, on a NEW parent, builds one atomic batch (parent at index 0, each child FK set to `{ $ref: 0 }`) via the new pure helper `buildMasterDetailBatch`. Client-side total rollups are merged into the parent payload before the batch. Edit mode and adapters without `batchTransaction` keep the existing client-orchestrated path.
  - `ObjectForm` gained a `submitHandler` hook: when supplied, the form validates and hands the collected values to the host instead of calling `dataSource.create` / `dataSource.update`. `MasterDetailForm` uses it to own the atomic parent+children write while the parent fields are still rendered by `ObjectForm`.

  **`@object-ui/types`**

  - `ObjectFormSchema.submitHandler?: (values) => any | Promise<any>` — typed override for host-owned persistence.

  Pairs with the framework-side ambient-transaction fix (ObjectQL `AsyncLocalStorage` transaction propagation) and the `/api/v1/batch` endpoint added in `@objectstack/rest`.

### Patch Changes

- b99d9bd: ADR-0048: package-scope the Studio metadata editor read. Two installed packages
  may ship metadata with the same `type`/`name`; the editor now resolves the right
  one instead of first-match.

  - `MetadataClient`: `layered()` and `getDraft()` accept `{ packageId }`, and
    `get()` emits the `package` query param (→ server prefer-local, `?package=`).
  - `ResourceListPage`: each item's edit link carries its owning package
    (`?package=<row._packageId>`), so even the unscoped "all" list disambiguates;
    falls back to the workspace suffix for runtime/overlay-only rows.
  - `ResourceEditPage`: reads `?package=` and scopes the layered + draft read to
    that package. (The route's `:appName` is the Studio app, not the edited item's
    owner, so the scope must come from the URL, not the active app.)

- a58c6b8: fix(datasource): exclude form-family views from `listViews()`

  `OBJECTSTACKDataSource.listViews(objectName)` feeds the object list-view
  switcher (`ObjectView` → `ViewTabBar`), but returned **every** view bound to
  the object — including form-family ones. With the backend now exposing each
  view as an independent **ViewItem** carrying a `viewKind` discriminant
  (ADR-0017, "Object has-many View"), a form view such as `crm_activity.default`
  (expanded from `formViews.default`) leaked in as a spurious switcher tab and,
  when opened, fell back to the default grid.

  `listViews()` now filters out `viewKind` `form`/`detail` items so only
  list-family views reach the switcher. Bare view specs without a `viewKind`
  (legacy artifacts and user-saved views) are still treated as list views.

- Updated dependencies [5976ba3]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [1394e34]
- Updated dependencies [300d755]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3

## 6.2.2

### Patch Changes

- @object-ui/types@6.2.2
- @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1

## 6.2.0

### Minor Changes

- ec8dcde: Add visual editing for object & field metadata in the Setup app.

  **`@object-ui/data-objectstack`** — new `MetadataClient` class. A thin,
  auth-friendly wrapper over the framework's `/api/v1/meta/*` REST
  endpoints (list / get / save / reset / history), with first-class
  support for `If-Match` (optimistic concurrency), `X-Actor` (audit
  attribution), environment-scoped paths
  (`/environments/:id/meta/*`), and 404-as-null semantics. Use
  `new MetadataClient({ baseUrl })` or `client.withEnvironment(id)` to
  target a specific environment.

  **`@object-ui/plugin-designer`** — two new route-ready pages that
  together close the "Data Model" management loop in the Setup app:
  - `MetadataObjectsPage` — lists every object schema (via
    `MetadataClient.list('object')`), renders the existing
    `ObjectManager`, and persists edits/deletes through PUT/DELETE on
    the metadata REST surface. Honours `allowRuntimeCreate` and
    surfaces server errors verbatim.
  - `MetadataFieldsPage` — for a single object, loads the parent
    schema, projects `fields` into the existing `FieldDesigner`, and
    on save merges the edited field map back into the object before
    issuing a single PUT. Preserves unknown per-field attributes so
    nothing the designer doesn't render is dropped.

  Both pages take either a pre-built `MetadataClient` or a
  `MetadataClientConfig`; neither imposes a routing convention on the
  host app — they can be mounted anywhere (e.g.
  `/apps/setup/_meta/object` and `/apps/setup/_meta/object/:name/fields`).

  These additions do not modify the underlying `ObjectManager` /
  `FieldDesigner` components, which remain pure controlled-input
  components usable in non-REST contexts.

### Patch Changes

- fe3c1d3: Metadata Admin engine — unified UI for all 27 metadata types.

  A generic, schema-driven admin shell that replaces the old per-type
  bespoke pages with a single registry-driven engine. Admins can now browse,
  create, override, diff, and roll back every registered metadata type from
  the Setup app → _All Metadata Types_.

  ### New: `@object-ui/app-shell` views/metadata-admin
  - **`MetadataDirectoryPage`** — auto-grouped tile directory by domain, with
    free-text search, domain chips, and a _Writable only_ filter.
  - **`MetadataResourceListPage` / `MetadataResourceEditPage` / `…CreatePage` / `…HistoryPage`** —
    generic CRUD shell. Uses the new `/meta/types` schema field to render
    SchemaForm; uses `?layers=code,overlay,effective` to power a 3-state diff
    tab; uses `/references` to warn before destructive deletes.
  - **`MetadataQuickFind`** — Cmd+Shift+M palette searching across types and
    items.
  - **`PermissionMatrixEditor`** — Salesforce-style matrix custom editor for
    `type=permission`. Objects × CRUD/VAMA/lifecycle columns with cascade
    rules (viewAllRecords ⟹ allowRead, etc.), expandable per-object field
    R/W subtable, bulk-set (R / CRUD / All / None), filter, _only granted_
    toggle, destructive-change confirmation, profile switch.
  - **`DesignerEditorWrapper`** — generic load–edit–save shell that hosts any
    bespoke designer (`ObjectViewConfigurator`, `DashboardEditor`,
    `PageCanvasEditor`, …). Handles dirty tracking, Save / Reset / Refresh /
    History buttons, and the read-only fallback when `allowOrgOverride` is
    false.
  - **`i18n.ts`** — bilingual (`en-US`, `zh-CN`) bundle for built-in type
    labels, domain labels, and engine UI strings, with `detectLocale()` and a
    `t(key)` helper.

  ### New routing variant
  - App nav now supports `{ type: 'component', componentRef, params? }` items.
    `AppContent` resolves them through the existing `ComponentRegistry`.
  - Built-in components registered: `metadata:directory`, `metadata:resource`,
    `metadata:object/edit` (FieldsPage), `metadata:permission/edit`
    (PermissionMatrixEditor), and lazy designer wrappers for view / dashboard
    / page.

  ### Plugin-designer
  - Lazy-exported `ObjectManager`, `FieldDesigner`, `ObjectViewConfigurator`,
    `DashboardEditor`, `PageCanvasEditor`, `MetadataObjectsPage`, and
    `MetadataFieldsPage` so the engine can mount them on demand.

  The temporary `/dev/meta` route is removed. Setup app navigation flows
  through the new component routes.
  - @object-ui/types@6.2.0
  - @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/core@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1

## 5.2.0

### Minor Changes

- de0c5e6: Add `DataSource.bulkDelete(resource, ids)` as the symmetric counterpart
  to `bulkUpdate`. Implemented in `data-objectstack` via the client's
  `deleteMany` primitive with a per-id fallback that emulates
  `continueOnError` semantics for older clients.

  Extract the bulk-vs-per-row decision into a reusable
  `executeBulkBatch(input, ops)` helper in `@object-ui/core`:
  - Single decision tree shared by both update and delete fast paths.
  - Bulk success → no per-row pass.
  - Bulk partial-count → aggregate batch error.
  - Bulk throw → per-row fallback so users still get id-level error detail.

  `useBulkExecutor` in plugin-grid now uses the helper for both `update`
  and `delete` batches, cutting "delete 500 selected rows" from 500 HTTP
  requests down to ~3.

- 9997cae: DataSource: add optional `bulkUpdate(resource, ids, patch)` for "same patch, many rows" interactions (Slack "mark all as read", Linear "archive selected"). The ObjectStack adapter routes to `POST /api/v1/data/:object/updateMany` so the client pays one HTTP/auth/RLS round-trip instead of N parallel PATCHes, eliminating mark-all-read jank on inboxes with 50+ unread.

  AppHeader's `markAllRead` now prefers `bulkUpdate`, with a transparent fallback to the per-id loop for adapters that don't implement the helper.

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [70b5570]
- Updated dependencies [d1442e3]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1
- @object-ui/core@5.1.1

## 5.1.0

### Minor Changes

- 5b80cfd: feat: Optimistic Concurrency Control (OCC) on DataSource writes

  `DataSource.update()` and `DataSource.delete()` now accept an optional fourth /
  third argument `opts?: { ifMatch?: string }`. When supplied, adapters forward
  the token to the backend; servers that implement OCC (e.g. ObjectStack
  `>=4.2.0`) compare it against the record's current `updated_at` and reject
  with `409 CONCURRENT_UPDATE` on mismatch, preventing silent overwrites in
  multi-user editing scenarios.

  **`@object-ui/data-objectstack`**
  - Exports `ConcurrentUpdateError` (carries `currentVersion` and
    `currentRecord`) and `isConcurrentUpdateError()` type guard.
  - `update()` / `delete()` accept `opts.ifMatch` and forward it via the
    `@objectstack/client` data API (header: `If-Match`). Requires
    `@objectstack/client@>=4.1.2` for the header to reach the server;
    older clients silently drop the option and fall back to today's
    "last writer wins" behaviour.
  - Adapter-level error handling maps a 409 with `code === 'CONCURRENT_UPDATE'`
    into a typed `ConcurrentUpdateError` so callers can detect and recover
    from conflicts without parsing the wire format.

  **`@object-ui/core`**
  - `ApiDataSource.update()` and `.delete()` accept `opts.ifMatch` and emit
    the `If-Match` HTTP header.

  UI consumers (Detail view, inline cell-edit) will be wired in a follow-up
  patch to capture `updated_at` at load time, pass it as `ifMatch` on save,
  and present a Reload / Overwrite / Cancel dialog on conflict.

### Patch Changes

- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/types@5.0.2
- @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1

## 5.0.0

### Minor Changes

- c7561a7: **Unify per-user UI state storage onto `sys_user_preference`.**

  `createObjectStackUserStateAdapter` previously wrote to a bespoke
  `user_app_state` object using `(user_id, kind, payload)` columns. That
  parallel KV table duplicated the canonical per-user preference store
  shipped by `@objectstack/plugin-auth`, and pulled UI traces (favorites,
  recent items, grid widths) out of the place users actually look for
  their settings.

  The adapter now defaults to:
  - `resource`: `sys_user_preference`
  - field shape: `(user_id, key, value)` instead of `(user_id, kind, payload)`
  - option name: **`key`** instead of `kind`

  `ConsoleShell` is updated to attach favorites/recent under the namespaced
  keys `ui.favorites` and `ui.recent`. Recommended convention for new
  adapters: keep machine-written UI traces under `ui.*` so they stay
  distinguishable from user-facing preferences (`theme`, `locale`, ...).

  **Migration**: callers passing `kind:` need to switch to `key:`. Callers
  relying on the old `user_app_state` table can pin
  `resource: 'user_app_state'` to keep the legacy behaviour, but no
  backend ships that schema and the new default works against any
  plugin-auth-enabled environment with zero extra setup.

### Patch Changes

- Updated dependencies [7213027]
  - @object-ui/types@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0
- @object-ui/core@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
  - @object-ui/types@4.5.0
  - @object-ui/core@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0
- @object-ui/core@4.4.0

## 4.3.1

### Patch Changes

- @object-ui/types@4.3.1
- @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- @object-ui/types@4.3.0
- @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6
- @object-ui/core@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5
- @object-ui/core@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4
- @object-ui/core@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/core@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1
- @object-ui/core@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/core@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/types@3.0.1
- @object-ui/core@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0
  - @object-ui/core@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
