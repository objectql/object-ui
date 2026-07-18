# @object-ui/types

## 16.0.0

### Major Changes

- 9b8f978: Adopt `@objectstack/spec` 15 across the workspace and drop the value-erased `…Schema` re-exports from `@object-ui/types` (#2561).

  **Removed exports.** `packages/types` re-exported the `@objectstack/spec/ui` surface inside `export type { … }` blocks, and those blocks included the zod validators (`DndConfigSchema`, `SpecFormViewSchema`, `ThemeModeSchema`, … 84 names in total). Under `export type` a zod value is erased, so importing any of them as a value from `@object-ui/types` silently yielded `undefined` at runtime. Per the #2561 decision (option a) the schema names are removed from the public surface instead of being converted to value re-exports — consumers that need the runtime validators import them from `@objectstack/spec/ui` directly. The inferred types (`DndConfig`, `SpecFormView`, …) are unchanged, and the genuine value re-exports (`defineStack`, `ObjectStackSchema`, `SpecReportSchema`, …) keep working. `BreakpointColumnMapSchema` / `BreakpointOrderMapSchema` are dropped without a type replacement (the spec exports no companion inferred type). A guardrail test (`spec-ui-schema-reexports.test.ts`) pins the contract.

  **Spec 15.** Every workspace package now depends on `@objectstack/spec` ^15.1.1. The `/ui` export-name set is identical to 14.6; the spec-level breaking change is ADR-0089 D3a — `FormFieldSchema` / `FormSectionSchema` / `PageComponentSchema` are `.strict()` and reject undeclared keys, which the workspace test suite passes under. The floor is 15.1.1 (not 15.0.0) because D3a's `.strict().transform(…)` pipes crashed `z.toJSONSchema` over spec's lazySchema proxies (`Cannot set properties of undefined (setting 'ref')`), breaking Studio's spec-derived Page/View inspector schemas; fixed upstream in framework#3021, which shipped in spec 15.1.1. New `view-schema.test.ts` pins the View-inspector derivation (previously untested — it degraded silently).

### Minor Changes

- b4ef588: feat(types): derive `ListViewSchema` from `@objectstack/spec/ui` instead of a hand-written copy (#2231)

  `@object-ui/types` shipped a hand-written mirror of the spec's UI ListView zod
  (`packages/types/src/zod/objectql.zod.ts`) plus a parallel hand-written TS `interface`
  (`objectql.ts`). Both had drifted from the authoritative `@objectstack/spec/ui`
  `ListViewSchema`, with nothing enforcing they stay in sync.

  - The zod `ListViewSchema` now **derives** from the spec's `ListViewSchema`: spec-owned
    fields (`filter`, `sort`, `selection`, `navigation`, `pagination`, `grouping`,
    `rowColor`, `userActions`, `appearance`, `tabs`, `addRecord`, `rowHeight`, `sharing`,
    `chart`/`tree` configs, `responsive`, `performance`, …) flow in **by reference** instead
    of being re-typed. The component envelope (`type: 'list-view'` discriminator +
    `objectName`) and the legacy objectui vocabulary (`viewType`, `fields`, `filters`, the
    `show*` toolbar flags, `densityMode`, `color`, …) plus the configs whose objectui shape
    is intentionally broader than spec's (`userFilters`, `sharing`, `aria`,
    `conditionalFormatting`, `exportOptions`, `kanban`/`calendar`/`gantt`/`gallery`/
    `timeline`) remain as sanctioned local `.extend()`s. Existing payloads keep validating;
    spec-canonical payloads (`columns`/`filter`/`userActions`) now validate too.
  - The hand-written TS `interface ListViewSchema` is replaced by
    `z.infer<typeof ListViewSchema> & ListViewRuntimeProps`, so the type can no longer drift
    from the schema. Non-serializable runtime-only props (`onNavigate`, `onDensityChange`,
    `refreshTrigger`) live in `ListViewRuntimeProps`.
  - Added a drift-guard test (`list-view-spec-parity.test.ts`) that fails if the spec grows a
    field objectui hasn't triaged, renames an aliased anchor (`type`/`columns`/`filter`), or
    an objectui-only field is added outside the sanctioned-local set.
  - Bumped the `@objectstack/spec` dependency `^14.6.0` → `^15.1.0` across the workspace
    (15.1.0 carries the framework#3021 `lazySchema`/`z.toJSONSchema` identity fix that the
    spec-derived Page/View inspectors depend on).

  Migrating the legacy vocabulary to the spec-canonical keys and adopting spec's narrower
  sub-shapes are deferred follow-ups (see #2231). No runtime behavior change.

- 5534535: feat(grid): built-in row Edit/Delete honor per-record CEL predicates (#2614)

  The object's `userActions.edit` / `userActions.delete` now also accept an
  object form `{ enabled?, visibleWhen?, disabledWhen? }`. The predicates are
  evaluated per row on the canonical CEL engine (`useRowPredicate`, the same
  machinery custom row actions use): `visibleWhen` false → the built-in
  Edit/Delete item is not rendered for that row (fail-closed); `disabledWhen`
  true → rendered disabled (fail-soft). Wired through ObjectGrid's
  RowActionMenu and the data-table's row overflow menu (the related-list
  path), with the app-shell `crudAffordances` mirror kept in lockstep.
  Omitting the predicates (or using plain booleans) keeps today's behavior
  bit-for-bit; declared predicates evaluate only when a row's menu opens, so
  grid rendering cost is unchanged.

### Patch Changes

- 210806a: chore(designer): drop the inert object "Enabled" toggle (framework#2377)

  The object designer showed an **Enabled** column (`ObjectManager` grid) and an
  editable **Enabled** boolean (add/edit object form), backed solely by the object
  `active` metadata property. `active` had no runtime consumer and was removed from
  `@objectstack/spec` (framework#3199, ADR-0049 enforce-or-remove) — so the toggle
  never disabled anything. Toggling it "off" left the object fully queryable and
  usable: a false affordance.

  Removed the column, the form field, the `active`↔`enabled` mapping/write-back in
  `MetadataObjectsPage`, the `enabled?` field on the designer `ObjectDefinition`
  type, and the now-unused `appDesigner.objectManager.enabled` string. Non-breaking:
  the metadata write path registers objects via `ObjectSchema.parse()`, which already
  strips unknown keys, and `ObjectDefinition.enabled` was designer-only.

  `isSystem` is unchanged (it stays a live spec property).

## 15.0.0

## 14.1.0

### Minor Changes

- 887062c: feat(dashboard): dashboard-level filters (date / region) driving multiple charts (framework#2501)

  A dashboard's `dateRange` + `globalFilters` declarations are now wired end to
  end: the filter values live as dashboard-level variables (the page variables
  primitive, so they're also readable as `page.<name>` in widget expressions),
  a filter bar renders above the widgets, and at render time the dashboard
  broadcasts the active values into every bound widget's inline query —
  `AND`-merged with the widget's own `filter`. Charts stay inline and
  self-contained; each widget maps a filter to **its own** field.

  - **`@object-ui/types`** — `globalFilters[].name` (stable filter/variable key,
    defaults to `field`) and `DashboardWidgetSchema.filterBindings`
    (`Record<string, string | false>`: per-widget field override / `false`
    opt-out). Zod mirrors included. **Pending paired `@objectstack/spec`
    alignment (framework#2501)** — same precedent as `dataset` /
    `categoryGranularity`.
  - **`@object-ui/core`** — new pure `dashboard-filters` module
    (`resolveDashboardFilterDefs`, `dashboardFilterVariableDefs`,
    `buildFilterCondition`, `buildWidgetScopedFilter`); `mergeFilters` lifted
    from plugin-report (re-exported there unchanged). Date presets emit
    date-macro tokens (`{30_days_ago}` …) so widgets resolve them at query time
    like hand-authored filters.
  - **`@object-ui/plugin-dashboard`** — `DashboardFilterBar` (date presets +
    custom range calendar, select with static `options` or `optionsFrom`,
    text/number inputs, reset); `DashboardRenderer` mounts a
    `PageVariablesProvider` when filters are declared and merges the
    widget-scoped condition into inline widgets' `filter` and dataset widgets'
    `runtimeFilter`. Dashboards without filters render exactly as before.

  Binding precedence: explicit `filterBindings` string/`false` → legacy
  `targetWidgets` allow-list → the filter's own `field` (dateRange defaults to
  `created_at`). Static-data widgets are not filtered.

- d5b1bc0: remove(tenant): drop the zero-consumer `@object-ui/tenant` package and the `types/tenant.ts` mirror (#2564)

  `@object-ui/tenant` (`TenantProvider` / `TenantGuard` / `TenantScopedQuery` /
  `createTenantResolver` / `useTenant` / `useTenantBranding`) was an
  exported-but-dead aspirational surface: no workspace package depended on it
  and nothing imported it. Its `TenantConfig.isolation` strategy enum
  (`'database' | 'schema' | 'row' | 'hybrid'`) was the UI mirror of the spec's
  `tenancy.strategy`, which framework#2763/framework#2962 removed under the same
  enforce-or-remove doctrine — the platform has exactly two tenancy modes, and
  neither is configured client-side.

  `@object-ui/types` no longer exports the tenant type family
  (`TenantConfig`, `TenantIsolationStrategy`, `TenantStatus`, `TenantPlan`,
  `TenantBranding`, `TenantLimits`, `TenantContext`,
  `TenantResolutionStrategy`, `TenantProviderConfig`,
  `TenantScopedQueryConfig`).

  Migration: real tenant scoping is server-enforced — `createAuthenticatedFetch`
  (`@object-ui/auth`) already injects the active organization as `X-Tenant-ID`
  on every API call, and the backend applies row-level isolation
  (`tenancy.enabled` + `tenantField` in `@objectstack/spec`). Per-tenant
  branding is a `ThemeSchema` concern. The skills guides and docs that
  advertised the dead package have been rewritten to say exactly that.

- f0f10f5: feat(kanban): default lane field honours the ADR-0085 `stageField` role

  Kanban views without an explicit `groupByField`/`groupField` hard-coded their
  lane field to the literal `'status'` (in both app-shell's ObjectView options
  and plugin-list's ListView fallback) — ignoring the object's declared
  lifecycle and even inventing a field the object doesn't have. The default now
  resolves through the shared `stageField` detector:

  1. explicit view config (unchanged, always wins);
  2. the object's `stageField` semantic role;
  3. `stageField: false` → **no default lanes** (the status-shaped field is
     declared non-linear; the board renders its empty state until the view
     picks a lane field explicitly);
  4. else the shared name/type heuristic (status / stage / state / phase by
     name, then status/stage by type) — never a nonexistent field.

  `detectStatusField` moved from `@object-ui/plugin-detail` to
  `@object-ui/types` (new export, with the `StatusFieldSource` input type) so
  plugin-list and app-shell share the exact semantics; plugin-detail re-exports
  it unchanged.

  Also fixes ListView's pre-existing rules-of-hooks error while touching the
  file: `useListFieldLabel` wrapped `useObjectLabel()` in try/catch (hook-order
  desync risk; the hook is provider-safe) — same fix as objectui#2595's
  `useFieldLabel`.

  Behavior change is limited to kanban views with no explicit lane field on
  objects that either declare `stageField` (now honoured), declare
  `stageField: false` (now suppressed), or have no status-shaped field at all
  (previously grouped by a nonexistent `status` into one "undefined" lane; now
  an honest empty state). Objects with a real `status` field — the common case —
  are unchanged.

### Patch Changes

- 2ded18c: Fix: a dashboard filter declaring its static `options` in the
  `@objectstack/spec` object form (`options: [{ value, label }]` — the shape
  the spec validates and what framework-authored dashboards ship) crashed the
  whole dashboard with "Objects are not valid as a React child". Caught driving
  the showcase Revenue Pulse dashboard in a real browser.

  `resolveDashboardFilterDefs` now normalizes both the spec object form and the
  bare-string shorthand (`options: ['EMEA']`) to `{ value, label }` pairs —
  `DashboardFilterDef.options` is typed accordingly — and the filter bar's
  select renders labels (the trigger now shows the selected option's label, not
  its raw value). `@object-ui/types` aligns the `GlobalFilterSchema.options`
  shape with the spec union.

- e628d1f: Dashboard-level filters follow-ups (#2578, framework#2501):

  - **i18n**: the `DashboardFilterBar` strings now ship as real locale entries —
    `dashboard.filters.*` (bar label, "All time", "Custom…", "All", "Reset",
    and the 13 date-range preset labels) added to `en` and `zh`. Previously the
    bar always rendered the `useSafeTranslate` English fallbacks.
  - **types**: `GlobalFilterSchema.name` and `DashboardWidgetSchema.filterBindings`
    landed in `@objectstack/spec` (framework#2501), so the local type
    annotations flip from "Pending alignment" to "Aligned" — no shape changes.

  Also adds five schema-catalog examples (`plugin-dashboard/filtered-dashboard-*`:
  dynamic `optionsFrom` options, text/number/lookup filter types, dataset +
  inline widget mix, `targetWidgets` allow-list, date presets + custom range)
  and a new "Dashboard-Level Filters" guide page covering the full tutorial,
  `page.*` expression usage, and known limitations with workarounds.

- 9e2d58f: Kanban `conditionalFormatting` now accepts CEL rules in its type + schema (#1584 follow-up).

  Since #1584 moved kanban card styling onto the shared CEL evaluator, the runtime
  already accepts the spec `{ condition, style }` rule shape — but the type and zod
  schema still only allowed the native `{ field, operator, value }` shape, so a
  CEL kanban rule failed validation for something that worked at runtime. The
  `KanbanConditionalFormattingRule` type and `ObjectKanbanSchema` zod schema are
  widened to a union of both shapes, matching list/grid `conditionalFormatting` and
  the runtime. Back-compat: the native shape keeps validating unchanged.

## 14.0.0

### Minor Changes

- 86c69c3: ADR-0089: read the canonical `visibleWhen` conditional-visibility predicate in the form + page renderers.

  `@objectstack/spec` now unifies conditional visibility under a single canonical key, `visibleWhen`, and folds the deprecated `visibleOn` (view form) / `visibility` (page component) aliases into it at parse. This updates ObjectUI to read the canonical key:

  - **Page renderer** (`SchemaRenderer`) — evaluates `visibleWhen` first (show-when-truthy), then the deprecated `visibleOn` / `visibility` as a defensive read for raw / un-normalized metadata. `visibleWhen` is stripped from DOM props.
  - **Spec→node bridges** — the page bridge maps a component's `visibleWhen ?? visibility` onto the node's canonical `visibleWhen`; the form-view bridge maps a field's `visibleWhen ?? visibleOn` onto the ObjectForm view-level predicate slot.
  - **Form renderers** — the `@object-ui/react` `FormRenderer` prefers `visibleWhen` over the `visibleOn` alias. (`ObjectForm`/`form.tsx` already evaluated `visibleWhen`.)
  - **Types** — the component base schema (`BaseSchema` / `base.zod`) gains the canonical `visibleWhen`; `visibleOn` is marked `@deprecated`.

  Fully back-compat: existing `visibleOn` / `visibility` metadata keeps working through the alias reads.

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

## 13.2.0

## 13.1.0

## 13.0.0

### Patch Changes

- 619097e: Adopt `@objectstack/spec` 13 (ADR-0090 Permission Model v2) across the workspace.

  Every workspace package now depends on `@objectstack/spec` ^13.0.0 — the v2 major that renames role → position (D3), removes the profile concept (D2), makes OWD default to `private` when unset (D1), and drops the legacy `read`/`read_write`/`full` sharing aliases (D4). UI fallout fixed in the same sweep:

  - **clientValidation**: the `role` draft-schema loader is now `position` → `PositionSchema` (fixes the `RoleSchema does not exist` build break, #2365); the dead `profile` loader is removed (D2).
  - **Studio previews**: `RolePreview` → `PositionPreview` (flat — positions carry no hierarchy; the old parent-chain breadcrumb and "assign to a Profile" copy are gone). Legacy `role`/`profile` preview keys stay registered for pre-v2 backends.
  - **OWD control** (`ObjectSettingsPanel`): removed the now-dead alias normalization (spec 13 rejects the aliases at authoring time) and the amber "fully public" warning — an unset sharing model now defaults to Private (D1), and the copy says so in both locales.
  - **Fallback schemas / anchors / samples**: `position` replaces the hierarchical `role` fallback schema; `isProfile` dropped from the permission create-anchor and previews samples; permission-set viewer no longer renders a profile badge; console System hub counts `sys_position` instead of the removed `sys_role`.
  - **Studio i18n**: type labels `Role/角色` → `Position/岗位`, `profile` label removed, Access-pillar heading and sharing copy rewritten to the v2 vocabulary.
  - `@object-ui/types` now exports `SubmitBehavior` (was defined but missing from the public surface, breaking `@object-ui/plugin-form`'s re-export under a clean build).
  - **External OWD dial (D11)**: the object Settings sharing card gains an `externalSharingModel` select (portal/partner baseline) with an inline wider-than-internal warning mirroring the publish-time lint.
  - **Permission matrix OWD badges**: every object row now shows its record-level baseline (`OWD Public read`, `Ext Private`, or `OWD Private (default)` for the D1 fail-closed unset case) so grant edits carry their record-reach context.

  The flow designer's approval assignee `role` kind is intentionally unchanged — spec 13 keeps it as the sole D3 exception (better-auth `sys_member.role` org-membership tier).

## 12.1.0

### Minor Changes

- c31874d: Record-header actions honour `Action.order`, so approval decisions no longer get buried in the `⋯` overflow menu (objectui#2339 / framework#2670).

  The `action:bar` renderer now stable-sorts its actions by an explicit **`order`** field (lower = higher / more prominent, default `0`) before the inline/overflow split. The sort is stable and treats unset `order` as `0`, so action groups where nobody sets `order` keep their exact registration order — existing toolbars are unaffected. `order` is added to `ActionSchema` in `@object-ui/types`, mirroring `Action.order` in `@objectstack/spec`.

  `RecordDetailView` now assigns the injected **Approve / Reject** decision buttons a strongly-negative `order` (and gives Approve the highlighted `primary` variant), so on a pending-approval record the approver's decision takes the primary-button slot and app `record_header` actions follow it — instead of the app having to hide its own actions to surface the decision.

## 12.0.0

### Minor Changes

- 226fde9: Cascading & role-gated `select` options (#2284).

  `select` options now accept a per-option `visibleWhen` CEL predicate — the option
  is offered only when it evaluates TRUE against the live record **plus
  `current_user`** (same engine/env as a field-level `visibleWhen`). Combined with a
  field-level `dependsOn`, this drives dependent selects (country → province → city)
  and role/context gating with no bespoke matrix — the same primitives dependent
  lookups (#2215) already use.

  - `@object-ui/core` exposes `resolveVisibleOptions` / `isOptionGroupGated` /
    `resolveDependsOnFields` / `isValueStillOffered` (evaluator), reusing the
    canonical `evalFieldPredicate`.
  - The form renderer narrows a dependent select's option list, gates the control
    with a "Select {parent} first" hint while a `dependsOn` field is empty, and
    clears a now-invalid value when the parent changes.
  - The standalone `SelectField` widget applies the same resolution via
    `dependentValues` + the global predicate scope.

  Client-side hiding is UX, not authorization: gate authorization-sensitive option
  values on the server too. Aligns with `@objectstack/spec` `SelectOption.visibleWhen`.

- e4de456: Fix form section grouping inconsistencies found in a UX review of grouped forms:

  - **Unified section visual language.** `FormSection`'s Card-wrapped path (used by Modal/Split/Tabbed/Wizard forms) previously rendered as a nearly-invisible white-on-white card (same `bg-card` as the page background, distinguished only by a barely-visible shadow) with a duplicated, inconsistent header (different title size, and a collapse chevron positioned differently) versus the flat `SectionDivider` path used by simple/drawer forms. Both now share the same header treatment (`text-sm font-semibold`, inline-left chevron, bottom border), and the Card path gets a soft `bg-muted/40` tint so grouped sections are visually distinguishable without relying on shadow alone.
  - **`readonly` no longer renders as `disabled`.** A field marked `readonly` (statically or via `readonlyWhen`) was being folded into the `disabled` prop before reaching field widgets, so widgets with a dedicated readonly display (e.g. `EmailField`'s mailto link, `TextField`'s plain-text view) never received it — every readonly field just looked permanently disabled. `readonly` is now forwarded as its own prop; generic `input`/`textarea` fields get a distinct readonly style (`bg-muted/40`, no `cursor-not-allowed`) instead of the disabled look.
  - **Section `className`/`gridClassName` now flow through JSON schemas.** `ObjectFormSection` and the per-form-variant section configs (`ModalFormSectionConfig`, `SplitFormSectionConfig`, `FormSectionConfig`, `DrawerFormSectionConfig`) accept `className` (and `gridClassName` where applicable), wired through `ObjectForm`'s form-type dispatch into `FormSection`/`SectionDivider` — closing a gap where section wrappers couldn't be customized from schema despite `FormSection` itself already supporting it.

## 11.5.0

### Minor Changes

- 1072701: Import wizard: use registered server-side import mappings (framework #2611). When an object has `mapping` metadata artifacts targeting it, the wizard shows a "Saved mapping" selector; picking one hands rename + transforms + write semantics to the server (the artifact is authoritative), replaces the manual column table with a read-only summary of the mapping, and submits `mappingName` over source-header rows (mutually exclusive with the inline column rename). `ImportRequestOptions` gains `mappingName`; the objectstack adapter gains `listImportMappings(objectName)` (feature-detected — the selector simply doesn't appear when unsupported). New `grid.import.*` strings added across all locales.

### Patch Changes

- 9255686: Record detail tabs are URL-addressable (`?tab=`) and survive subtree remounts (objectui#2257, ADR-0054 C3).

  - `buildDefaultTabs` emits STABLE semantic tab values (`details` / `related:<child>` / `related` / `activity` / `history`) instead of leaving the renderer to synthesize index-derived ones.
  - `PageTabsRenderer` honors `item.value`, a host-provided `schema.defaultTab` (validated against actual tabs) and `schema.onTabChange`; index fallback kept for authored schemas without values.
  - app-shell `RecordDetailView` restores the active tab from `?tab=` and writes it back with `replace` (tab switches never stack history), via the pure `withPageTabsUrlSync` page-tree injector (never mutates authored/memoized page schemas). Legacy `DetailView.autoTabs` wired to the same contract (`defaultTab`/`onTabChange`).
  - Fixes the tab strip resetting to Details after save-refresh remounts (`refreshKey`-style) and dev-StrictMode URL churn; enables `?tab=` deep links; invalid values fall back to Details.

## 11.4.0

### Minor Changes

- 8bf6295: feat: adaptive record surface + semantic field span + responsive columns (framework#2578)

  Field-heavy objects (all metadata is AI-authored) now present themselves without
  any authored presentation config:

  - **Adaptive surface** — a record's create/edit/detail opens as a full page when
    the object is field-heavy, or a drawer when it is light. Derived from field
    count (`deriveRecordSurface`), not authored; mobile always pages. Wired into the
    app-shell ObjectView detail navigation (an authored view/object `navigation`
    still wins).
  - **Semantic field span** — `FormField.span` (`auto`/`full`) is a width primitive
    decoupled from the (per-surface derived) column count; legacy `colSpan` is
    clamped so it never overflows. `ObjectForm` now honours per-section `columns`
    and carries `span`/`colSpan` from section defs — fixes the bug where
    `type:'simple'` ignored `section.columns` and grouped fields rendered single
    column.
  - **Responsive columns** — `inferColumns` scales the column CAP with field count
    (≤3→1, ≤8→2, ≤15→3, 16+→4); the ACTUAL column count follows the form's real
    width via CSS container queries, so the same form goes 1→2→3→4 columns as a
    drawer widens or becomes a page.
  - **Runtime overlay width** — `NavigationConfig.size` bucket is resolved to a
    viewport-clamped width at runtime (`overlayWidthFor`); a pixel width is never
    authored (the author cannot know the client viewport).

### Patch Changes

- 1948c5b: fix(plugin-grid): keep the grid's row selection in sync when a bulk-action dialog closes

  Closing a bulk-action result dialog (e.g. 派工 / 下推) on **Done** cleared
  ObjectGrid's `selectedRows` — which drives the selection toolbar — but never
  touched the DataTable's internal checkbox state. Two visible problems:

  - **Desync on success.** The toolbar disappeared while every row stayed visibly
    ticked, because the checkboxes are table-internal state the grid couldn't
    reach.

  - **Lost selection on total failure.** When the run failed for _every_ row
    (0 succeeded — a precondition error, say), the toolbar still vanished,
    stranding the user with no way to retry the exact rows they'd picked.

  The dialog-close handler now gates the reset on `result.succeeded > 0`: a total
  failure keeps both the selection _and_ the toolbar (and skips the phantom
  refetch) so the user can fix the cause and retry. When it does reset, a new
  `selectionResetKey` prop on DataTable clears the internal checkbox selection in
  lockstep with the toolbar, so the two never drift apart.

- c38d107: Fix view-level `FormField.visibleOn` (CEL) never taking effect (#2212).

  The spec ships `visibleOn` as an Expression object `{ dialect: 'cel', source }`
  (what the `P` template emits) or a bare string, but the whole chain dropped it:

  - `sectionFields.ts` / `ObjectForm.tsx` only accepted the bare-string shape and
    attached a dead `visible()` closure no renderer ever called — the Expression
    object shape was silently discarded.
  - The form renderer destructured `visibleOn` out of the field config and never
    evaluated it.
  - `RecordFormPage` dropped a `simple` form view's `sections` entirely, so
    page-mode create/edit fell back to the raw schema (every field, no authored
    selection/grouping) while the modal path honored the same view.
  - `ObjectForm`'s grouped-sections path matched section fields by name only,
    dropping per-field `visibleOn` overrides.

  `visibleOn` now flows through normalization verbatim (both wire shapes) and is
  evaluated reactively by the form renderer with the canonical expression engine
  (`evalFieldPredicate` — same engine, record scope, and fail-open semantics as
  field-level `visibleWhen`; both predicates must allow a field for it to show).
  Sectioned/flat normalization also copies field-level `visibleWhen` /
  `readonlyWhen` / `requiredWhen` rules it previously lost.

## 11.3.0

## 11.2.0

## 11.1.0

## 7.3.0

## 7.2.0

### Minor Changes

- d23db5c: feat(detail): related-list add-by-picker (generic m2m/junction) + a generic "Assigned Users" management UI on permission sets (assign ai_seat and any role with zero bespoke CRUD; server-side cap errors surface inline).

## 7.1.0

### Minor Changes

- 677f7ed: feat(charts,dashboard): data-screen customization primitives

  - object-metric `variant:'bare'` — big tinted number + label, no card chrome
    (data-screen KPIs that stay data-bound).
  - object-chart `colors` prop overrides the theme `--chart-1..n` palette so a
    page/dashboard can brand its charts; compact metric formatting (`'0.0a'` →
    "1.1M").
  - ObjectChartSchema.chartType widened to donut/horizontal-bar/column.

- a71be60: chore: drop the unrendered `blank` / `record_review` page types and their config

  The `blank` and `record_review` page types have no renderer and were removed
  from `@objectstack/spec`'s `PageTypeSchema` (framework#2265, enforce-or-remove).
  This drops their now-dead references in objectui so the upstream spec can hard-
  remove `BlankPageLayoutSchema` / `RecordReviewConfigSchema`:

  - `PageType` union: removed `dashboard` / `form` / `record_detail` /
    `record_review` / `overview` / `blank` (grid/gallery/kanban/calendar/timeline
    remain — those are list _visualizations_, a separate cleanup).
  - Removed `blankLayout` from `PageLayout` and the `blankLayout` / `recordReview`
    handling in the spec→SDUI page bridge.
  - Removed the redundant `BlankPageLayout{,Schema,Item,ItemSchema}` re-import from
    `@objectstack/spec/ui` (it was never used).

### Patch Changes

- cb03bc3: feat(types): type `object-chart` `colors` as a palette OR a value→color map

  `ObjectChartSchema.colors` now accepts either a positional palette (`string[]`)
  or an explicit value→color map (`Record<value, color>`, kanban-style). This
  matches the chart renderer, which resolves a select/lookup dimension's option
  colors per category and lets them (and any explicit map) win over the
  positional palette — so health green/red/yellow paints semantically.

## 7.0.0

### Major Changes

- 858ad94: **Breaking:** remove `@object-ui/plugin-workflow` and its schema types.

  The package's designers (`WorkflowDesigner`, `FlowDesigner`, `AutomationBuilder`,
  `ApprovalProcess`, `AutomationRunHistory`) authored BPMN-style / standalone-workflow
  shapes the ObjectStack automation engine does not execute (ADR-0020, ADR-0031), and
  nothing in the console, runner, or examples consumed them.

  Removed from `@object-ui/types`: `WorkflowSchema`, `WorkflowDesignerSchema`,
  `ApprovalProcessSchema`, `WorkflowInstanceSchema`, `FlowDesignerSchema` and the
  related `Workflow*` / `Flow*` helper types (formerly `./workflow`).

  **Migration:** author flows in the Studio's metadata-admin flow designer
  (`@object-ui/app-shell` → `FlowCanvas`), whose node palette is driven by the
  engine's published action registry (`GET /api/v1/automation/actions`). Run
  history is available in the same view via the Runs panel; approval UI ships
  with the framework's `plugin-approvals`.

### Minor Changes

- ddbe4a2: B2 step 3: client-side field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`). The form renderer now evaluates these CEL predicates reactively against the live record and gates each field's visibility, read-only state, and required-ness accordingly. Evaluation delegates to the canonical `@objectstack/formula` `ExpressionEngine` — the _same_ dialect the server enforces (`requiredWhen` in the rule-validator, `readonlyWhen` in `stripReadonlyWhenFields`) — so the UX and the persisted verdict always agree. New core helpers `evalFieldPredicate` / `resolveFieldRuleState` (zero-React, fail-open). `FormField` gains `visibleWhen` / `readonlyWhen` / `requiredWhen` (+ deprecated `conditionalRequired` alias), and `ObjectForm` carries them through from object metadata.
- 9049bbe: Add end-user friendly agent process summaries for chatbot tool calls, with a debug mode for raw reasoning and tool details. Console chat surfaces now keep a sanitized browser-side display cache so refreshes can restore user/assistant text plus grouped tool states when the backend returns no message rows.
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

- 300d755: feat(form): inline master-detail in a plain ObjectForm via `subforms`

  `ObjectFormSchema` gains a `subforms` array. When set, a regular `object-form`
  renders as a master-detail form — the object's own fields on top, an editable
  grid per child collection below, persisted together in one atomic transaction —
  without a bespoke `object-master-detail-form` page.

  ```ts
  { type: 'object-form', objectName: 'expense_claim',
    subforms: [{ childObject: 'expense_line' }] }   // FK + columns auto-derived
  ```

  Each subform needs only `childObject` (relationship FK and columns are derived
  from the child object's metadata; override with `relationshipField`/`columns`).
  This is the config-driven, page-less way to express master-detail entry — a form
  view can declare its child collections directly.

- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

### Patch Changes

- cb2fdb1: feat(dashboard): expand drill-in — table/list row→record + scatter/treemap/sankey drill-through

  Drill-in now covers the widgets that were missing it, and formalizes the two
  interaction semantics mainstream BI/low-code platforms separate. `DrillDownConfig`
  gains a `mode` discriminator: `'filter'` (drill-through: aggregate bucket → filtered
  record list) and `'record'` (drill-to-record: a table/list row → that record's detail).

  - Scatter, treemap and sankey charts now wire click → the existing filtered-record
    drill drawer (radar excluded — no single clickable category point). The
    Recharts-payload → drill-event mapping is extracted to pure, tested functions.
  - Object-backed table/list widgets drill to the clicked record in a read-only detail
    drawer (Sheet/Dialog), on by default (`drillDown:{enabled:false}` opts out). Field
    labels and value formatting (incl. tenant-default currency) are shared with the
    table cells so a value reads identically in both. An author-supplied `onRowClick`
    still wins.
  - The chart/KPI drill-through record lists now drill into a record too, completing the
    segment → list → record chain.

- 6cfa330: feat(dashboard): drill "Open in list" escape hatch + unify report drill

  Adopts the mainstream BI peek-then-escalate drill model. Drill-through opens an
  in-place drawer (keep context) and offers an "Open in list →" affordance to
  escalate to the object's full list page (sort / bulk-select / export / shareable
  URL) — the Looker / Power BI "see records → open in page" pattern.

  - New `DrillNavigationContext` (`@object-ui/react`): the app shell provides
    `openRecordList`; the renderer stays decoupled from console routing.
  - The drill drawers (pivot / dataset / chart / KPI) render the escape hatch when
    a host navigation handler is present, and hide it otherwise (self-contained
    peek). `DashboardView` provides the handler via `useOpenRecordList`.
  - `DrillDownConfig.target` gains `'navigate'` — skip the drawer and open the
    list directly; degrades to `'drawer'` when no host handler is available.
  - `ReportView` drill-through now opens the same in-place drawer (peek records →
    click a row to open a record) instead of navigating away; the escape hatch
    preserves the previous navigate-to-list behavior. Dashboard and report drill
    are now unified.
  - i18n: `dashboard.openInList` (en / zh).

- ad8ade6: feat(components): metadata-derived field locators on generated forms (ADR-0054 Phase 4)

  The form renderer now emits a stable `data-testid="field:{objectName}.{field}"`
  (plus `data-field`) on every field wrapper, derived from the form's `objectName`
  and each field's name — closing the locator gap at the source so every generated
  form (`ObjectForm`/`ModalForm`/`DrawerForm`/`SplitForm`/`WizardForm`) inherits
  testable fields with zero per-app work (ADR-0054 C4). `FormSchema` gains an
  optional `objectName`; the object prefix is omitted (`field:{field}`) when a form
  has none. `FormItem` now accepts `data-*` attributes.

- 3870c20: feat(forms): declarative `navigateOnSuccess` + `resetOnSuccess` on object-form

  Rounds out declarative success behavior for metadata-only forms (which can't
  pass an `onSuccess` function), complementing `successMessage`:

  - **`navigateOnSuccess`** — after a successful create/update, navigate here.
    Supports `{id}`/`{recordId}` interpolation from the saved record and is
    same-origin-guarded; takes precedence over the toast (landing on the record
    is the confirmation).
  - **`resetOnSuccess`** — after a successful create, reset the form for another
    entry (the wizard returns to a cleared step 1). Ignored when navigating.

  Wired in both ObjectForm and WizardForm via a small shared `successBehavior`
  helper (kept dependency-free to avoid an EmbeddableForm import cycle).

- b88c560: feat(forms): declarative `successMessage` on object-form

  Metadata-only forms (a wizard/object-form authored as JSON) cannot pass an
  `onSuccess` function, so the post-create/update feedback was a fixed
  "Created"/"Saved" toast. `ObjectFormSchema` now accepts `successMessage`, which
  ObjectForm and WizardForm use for the default success toast when no `onSuccess`
  handler is supplied. Falls back to "Created"/"Saved".

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

## 6.1.0

### Minor Changes

- 991b62d: Add `compareTo` field to dashboard widgets for period-over-period
  comparison. Supports `'previousPeriod'`, `'previousYear'`, and
  `{ offset: '7d' | '4w' | '1M' | '1y' }`.
  - **Metric / gauge widgets** now compute a delta percentage when `compareTo`
    is set and surface it as a derived `trend` (auto-labelled via
    `dashboard.trend.vsLast*` i18n keys sniffed from the filter macros).
  - **Chart widgets** (line / area / bar / horizontal-bar / scatter / combo)
    overlay a muted comparison-period series (dashed line, lower fill opacity).
    Pie / donut / funnel ignore `compareTo`.
  - New core utilities: `shiftFilterByCompareTo`, `compareToTrendLabelKey`,
    `computeMetricDelta`, and `CompareToConfig` type.
  - `ChartSeries` now accepts `variant: 'comparison'`, `dashArray`, and
    `opacity` overrides for visual treatment.

  See `packages/plugin-dashboard/SKILL.md` for usage examples.

## 6.0.4

## 6.0.3

## 6.0.2

## 6.0.1

## 6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

### Minor Changes

- 3a8c754: Rebuilt the chatbot UI on top of **Vercel AI Elements** (MIT) and wired in
  the v1 capabilities exposed by `@objectstack/service-ai` (tracing,
  `generateObject`, `query_data` tool, `ModelRegistry`).
  - **What's new**
    - `ChatbotEnhanced` is now composed from `Conversation`, `Message`,
      `PromptInput`, `Suggestion`, `Tool`, `Reasoning`, `Sources`, and friends.
      Sticky-to-bottom scrolling, keyboard-aware textarea, file pill chips,
      copy/retry actions, and the streaming/error banners now match the
      shadcn-style AI surface used across the ecosystem.
    - **Tool / reasoning / sources rendering**: assistant messages with
      `toolInvocations`, `reasoning`, or `sources` automatically render the
      collapsible tool panels, the chain-of-thought block, and the citation
      pill. `useObjectChat` parses these directly from `vercel/ai`'s
      `UIMessage.parts` stream — no extra wiring needed at the call site.
    - **Model picker**: optional `models` + `selectedModelId` + `onModelChange`
      props render an inline `<select>` in the prompt-input toolbar. Designed
      to be fed straight from `GET /api/v1/ai/models` (new in service-ai
      v1).
    - **Trace links**: new optional `traceId` on `ChatMessage` surfaces a
      small "trace" link on assistant messages — pair with the `ai_traces`
      object exposed by service-ai's auto-tracing.
    - New optional `suggestions?: string[]` prop renders a chip row in the
      empty state and forwards the picked suggestion to `onSendMessage`.
    - All vendored AI Elements (10 components) plus two missing shadcn
      primitives (`button-group`, `input-group`) are exported as a namespace —
      `import { AIElements } from '@object-ui/plugin-chatbot'` — so apps can
      compose bespoke chat surfaces without dropping back to the legacy
      primitives.
  - **Type-level changes**
    - `@object-ui/types` `ChatMessage` gains optional `reasoning`, `sources`,
      `traceId` fields, and a new `ChatMessageSource` interface.
    - `ChatToolInvocation` accepts the AI SDK v6 lifecycle states
      (`input-streaming`/`input-available`/`output-available`/`output-error`/
      …) in addition to the legacy `partial-call`/`call`/`result`. `args`
      is now optional and accepts arbitrary shapes; new optional `errorText`
      field.
  - **What hasn't changed**
    - Public prop signature on `FloatingChatbot`, `FloatingChatbotPanel`, and
      the SDUI `"chatbot"` renderer.
    - Hook contracts: `useObjectChat`, `useAgents`,
      `useFloatingChatbot`.
    - SSR / Tailwind 4 / React 18+19 support.
  - **Under the hood**
    - New deps: `streamdown`, `use-stick-to-bottom`, `shiki`, `motion`,
      `nanoid`, `@radix-ui/react-use-controllable-state`,
      `@radix-ui/react-slot`, `class-variance-authority`.
    - Vendored sources live under `src/elements/` with header comments pointing
      back to `registry.ai-sdk.dev`. Rule #7 No-Touch Zones are respected —
      `packages/components/src/ui/**` was not modified.

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

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

- 70b5570: `record:path` now distinguishes won/lost terminal stages. Stages can opt
  in via the new `terminal: 'won' | 'lost'` property on each stage entry,
  and the renderer also falls back to a value/label heuristic (matches
  `closed_lost`, `lost`, `failed`, `cancelled`, `失败`, `流失`, `丢单`, etc.)
  so existing CRM-style picklists get the treatment without migration.
  - **Lost** stages render in a visually separated group with a left
    border, destructive (red) tint, pill shape, and `✗` glyph — mirroring
    the Salesforce / HubSpot alt-terminus pattern that signals "this
    breaks the forward path, not steps past it."
  - **Won** terminus (the last stage of the forward chevron) gets a subtle
    emerald wash + 🏆 glyph to read as "the goal," even before the record
    reaches it.
  - Mobile pill row distinguishes lost via color, since the layout doesn't
    have room to fork the row.

## 5.1.1

## 5.1.0

### Minor Changes

- cf30cc2: Polish Lightning record detail page layout.
  - `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
  - Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
  - The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
  - Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
  - Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
  - Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

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

## 5.0.2

## 5.0.1

## 5.0.0

### Minor Changes

- 7213027: feat(detail): slotted record pages (Track 3 Phase I)

  Introduce `kind: "slotted"` record pages that override one or more
  named slots while letting the default-page synthesizer fill in the
  rest. Authors no longer need to re-author the entire page just to
  customize the header or one tab.

  **Slot menu (v1):**
  - `header` — replaces `page:header`
  - `actions` — replaces the `record:quick_actions` action bar
  - `highlights` — replaces the chips + chevron path strip
  - `details` — replaces the Details tab body (other tabs stay synthesized)
  - `tabs` — replaces the entire `page:tabs` node (wins over `details`)
  - `discussion` — replaces the inline `record:discussion` footer

  Each slot is a full replacement at the slot boundary. To compose
  default + custom, call the corresponding `buildDefault*` sub-builder
  (now exported from `@object-ui/plugin-detail`):
  `buildDefaultHeader`, `buildDefaultActions`, `buildDefaultHighlights`,
  `buildDefaultDetails`, `buildDefaultTabs`, `buildDefaultDiscussion`.

  **Author shape:**

  ```ts
  {
    type: 'record',
    object: 'account',
    kind: 'slotted',
    slots: {
      header: { type: 'page:header', properties: { ... } },
    },
  }
  ```

  **API changes:**
  - `PageSchema` (in `@object-ui/types`): adds `kind?: 'full' | 'slotted'`
    (default `'full'`) and `slots?: PageSlotMap`.
  - `usePageAssignment` (in `@object-ui/react`): result now exposes a
    `slots` field populated when the matched page has `kind === 'slotted'`.
    Existing `page` field is unchanged for full pages.
  - `buildDefaultPageSchema` (in `@object-ui/plugin-detail`): accepts an
    `options.slots` map that overrides individual regions at synthesis time.

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

### Minor Changes

- ab5e281: `record:highlights` renderer normalizes rich field items.

  `RecordHighlightsComponentProps.fields` is now `Array<string | { name, label?, icon?, type? }>`. The renderer normalizes both forms before passing to `HeaderHighlight`, so schemas can attach per-instance label/icon overrides without editing the underlying object metadata. FLS and `redactFields` still apply on the normalized list.

## 4.4.0

## 4.3.1

## 4.3.0

## 4.2.1

## 4.2.0

## 4.1.0

## 4.0.12

## 4.0.11

## 4.0.10

## 4.0.9

## 4.0.8

## 4.0.7

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## Unreleased

### Added

- **`ObjectSchemaMetadata.editMode`.** Optional `'modal' | 'page'` flag
  declaring whether record create/edit should open the global
  `<ModalForm>` (default) or navigate to the dedicated full-screen route
  mounted by `@object-ui/app-shell` (`/apps/:appName/:objectName/new` and
  `/apps/:appName/:objectName/record/:recordId/edit`). Default remains
  `'modal'` so existing schemas are unaffected. See the new guide at
  `content/docs/guide/record-edit-modes.md` for details.

## 4.0.1

## 4.0.0

### Major Changes

- Release v4.0.0: Unified app shell, convention-based i18n, and plugin architecture overhaul.

  ### Major Changes
  - **`@object-ui/app-shell`**: New unified application shell with sidebar, breadcrumb, and dashboard wiring.
  - **`@object-ui/providers`**: Promoted to first-class fixed package; new `DataSourceProvider` and `ThemeProvider` APIs.
  - **Convention-based i18n** (`@object-ui/i18n`): `useObjectLabel` now covers nav groups, dashboards, pages, reports, charts, and field options — zero-config localisation via translation packs.
  - **Dashboard surface i18n**: `DashboardRenderer`, `DashboardView`, `ChartRenderer`, `ObjectDataTable`, `ObjectChart`, and `data-table` all resolve labels through the i18n convention.
  - **Sidebar/breadcrumb/chart i18n**: Full i18n coverage across navigation, breadcrumbs, chart axes/legends, and table column headers.
  - **System view immutability**: Read-only UI affordances for system-managed views.
  - **Multi-level grouping**: Nested sub-group support with inline grouping editor.
  - **Record title resolution**: `titleFormat` and separator cleanup for consistent record display.

## 3.4.0

### Minor Changes

- f1ca238: Async streaming export — spec v4 export job lifecycle end-to-end

  For tenants with millions of records the legacy in-memory CSV/JSON export blew
  past the browser's heap. This change wires the spec v4 streaming-export
  contract through the renderer end-to-end:

  **`@object-ui/types`** — `DataSource` gains four optional methods:
  - `createExportJob(resource, request)` → `{ jobId, status, estimatedRecords, createdAt }`
  - `getExportJobProgress(jobId)` → `{ status, processedRecords, totalRecords, percentComplete, downloadUrl, … }`
  - `cancelExportJob(jobId)` (optional)
  - `getExportJobDownloadUrl(jobId)` (optional — for short-lived signed URLs)

  Mirror the spec v4 `CreateExportJobRequest` / `ExportJobProgress` shapes; types
  remain dependency-free.

  **`@object-ui/components`** — new public API:
  - `useExportJob({ dataSource, pollIntervalMs, onComplete, onError })` — owns the
    full polling loop, terminal-state handling, cancel, and download.
  - `<ExportProgressDialog open onOpenChange job filename closeAfterDownloadMs />` —
    determinate or indeterminate progress bar, byte/record counts, Cancel while
    running, Download on completion, error banner on failure.

  **`@object-ui/plugin-grid`** — `ObjectGrid` now auto-detects async export
  support: when the `DataSource` exposes `createExportJob` + `getExportJobProgress`
  (and the schema isn't using inline `value` data) the export popover routes
  through the streaming path with a progress dialog. Otherwise it falls back to
  the existing client-side blob path. Set `exportOptions.streaming = false` to
  force the legacy path.

### Patch Changes

- de881ef: Mobile UX round 3 — Form: sticky save bar, fullscreen long-text editor, and auto-stepper for long forms on small viewports.

  **`@object-ui/types`** — `ObjectFormSchema.mobile` (new) lets a single form opt into all three behaviours:

  ```ts
  {
    type: 'object-form',
    objectName: 'leads',
    mode: 'create',
    mobile: {
      stickyActions: true,        // pin Submit/Cancel to bottom on phones
      stepper: 'auto',            // long forms render one field per step
      stepperMinFields: 8,        // …but only past this many fields
      stepperFieldsPerStep: 1,    // … (default 1)
      fullscreenLongText: true,   // textarea fields get an "expand" affordance
    },
  }
  ```

  `FormSchema.mobileStickyActions` (new) is the lower-level escape hatch — applied automatically when `mobile.stickyActions` is set on `ObjectFormSchema`.

  **`@object-ui/plugin-form`** — `ObjectForm` now:
  - propagates `mobile.fullscreenLongText` to every textarea/markdown/html field as `mobile_fullscreen: true`,
  - sets `mobileStickyActions` on the inner form schema and adds `pb-20` padding so content isn't covered by the fixed bar,
  - when `mobile.stepper === true` (or `'auto'` + `useIsMobile()` + > `stepperMinFields` fields), routes the flat field list through the existing `WizardForm` with synthetic single-field "steps" — keeping per-step validation and the existing `Next`/`Back`/`Submit` flow.

  **`@object-ui/components`** — the registered `form` renderer adds:
  - a `mobileStickyActions` opt-in that turns the action row into a `position: sticky; bottom: 0` bar on small viewports, and
  - an inline `FullscreenTextarea` wrapper used when no field-package widget is registered, providing the same expand-button + edit-dialog UX so the feature works even in lighter setups.

  **`@object-ui/fields`** — `TextAreaField` ships the actual fullscreen UX: a top-right `Maximize2` button opens a near-fullscreen `Dialog` containing a full-height `Textarea` with a draft-then-commit save model (Cancel reverts).

  All three behaviours are off by default — existing forms render unchanged.

## 3.3.2

## 3.3.1

## 3.3.0

## 3.2.0

## 3.1.5

## 3.1.4

## 3.1.3

## 3.1.2

## 3.1.1

### Patch Changes

- Patch release v3.1.1

## 3.0.3

## 3.0.2

## 3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements

## 0.3.0

### Minor Changes

- New plugin-object and ObjectQL SDK updates

  **Added:**
  - New Plugin: @object-ui/plugin-object - ObjectQL plugin for automatic table and form generation
    - ObjectTable: Auto-generates tables from ObjectQL object schemas
    - ObjectForm: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
    - Full TypeScript support with comprehensive type definitions
  - Type Definitions: Added ObjectTableSchema and ObjectFormSchema to @object-ui/types
  - ObjectQL Integration: Enhanced ObjectQLDataSource with getObjectSchema() method using MetadataApiClient

  **Changed:**
  - Updated @objectql/sdk from ^1.8.3 to ^1.9.1
  - Updated @objectql/types from ^1.8.3 to ^1.9.1

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:
  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing
