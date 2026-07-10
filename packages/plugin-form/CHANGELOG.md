# @object-ui/plugin-form

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/fields@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/permissions@13.0.0

## 12.1.0

### Patch Changes

- 195121a: Studio form designer + preview now match the runtime form's column density.

  The Data pillar's **Form → Layout** designer laid every section out in a fixed 2-column grid capped at `max-w-3xl`, and **Form → Preview** capped the real `ObjectForm` at `max-w-2xl`. So on a wide screen the studio showed at most 2 columns while the record the end user actually edits spreads to up to 4 — the design surface misrepresented the real layout.

  `ObjectFormDesigner` now derives its column count the same way the runtime form does (`inferColumns` over the object's editable field count, objectui#2578) and lays each section out with the shared container-query grid classes (`containerGridColsFor`) inside a per-section `@container`, so a field-heavy object reaches 4 fields per row on wide screens and collapses to one column when the panel is narrow. Wide widgets (textarea/markdown/html/…) span the full row, mirroring the form. Both the layout and preview canvases were widened to `max-w-6xl` so the container queries can actually reach 4 columns. `containerGridColsFor` is now exported from `@object-ui/plugin-form` as the single source of truth for these grid classes.

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/fields@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/permissions@12.1.0

## 12.0.0

### Minor Changes

- e4de456: Fix form section grouping inconsistencies found in a UX review of grouped forms:

  - **Unified section visual language.** `FormSection`'s Card-wrapped path (used by Modal/Split/Tabbed/Wizard forms) previously rendered as a nearly-invisible white-on-white card (same `bg-card` as the page background, distinguished only by a barely-visible shadow) with a duplicated, inconsistent header (different title size, and a collapse chevron positioned differently) versus the flat `SectionDivider` path used by simple/drawer forms. Both now share the same header treatment (`text-sm font-semibold`, inline-left chevron, bottom border), and the Card path gets a soft `bg-muted/40` tint so grouped sections are visually distinguishable without relying on shadow alone.
  - **`readonly` no longer renders as `disabled`.** A field marked `readonly` (statically or via `readonlyWhen`) was being folded into the `disabled` prop before reaching field widgets, so widgets with a dedicated readonly display (e.g. `EmailField`'s mailto link, `TextField`'s plain-text view) never received it — every readonly field just looked permanently disabled. `readonly` is now forwarded as its own prop; generic `input`/`textarea` fields get a distinct readonly style (`bg-muted/40`, no `cursor-not-allowed`) instead of the disabled look.
  - **Section `className`/`gridClassName` now flow through JSON schemas.** `ObjectFormSection` and the per-form-variant section configs (`ModalFormSectionConfig`, `SplitFormSectionConfig`, `FormSectionConfig`, `DrawerFormSectionConfig`) accept `className` (and `gridClassName` where applicable), wired through `ObjectForm`'s form-type dispatch into `FormSection`/`SectionDivider` — closing a gap where section wrappers couldn't be customized from schema despite `FormSection` itself already supporting it.

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e36a9c7]
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/fields@12.0.0
  - @object-ui/permissions@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Patch Changes

- fae75e2: Fix two bugs verified still-present after #2254 claimed to resolve them (framework#2620 / framework#2616 Showcase UX pass, tracked in #2268):

  - **Wizard/form `submitBehavior: 'thank-you'` allowed duplicate resubmission.** #2254 fixed the spec-bridge dropping `submitBehavior` before it reached the renderer, so the configured toast message started appearing — but `WizardForm`'s last step and `ObjectForm`'s submit handler only ever called `toast.success(...)` for `thank-you`/`next-record`; the form stayed mounted and fully filled with its submit button re-enabled once the request settled, so a second click created a second record. Both components now track a terminal `submitted` state and, when set, replace the form with a confirmation panel (using the behavior's `title`/`message`, which were also never read before) — mirroring the pattern `apps/console/src/components/FormPage.tsx` already used for its own standalone forms.

  - **Command Center-style 3-up chart bands stayed collapsed to ~100-130px, and a dataset-bound chart's measure leaked its raw field name.**
    - `responsiveStyles` (and `style`) were declared on the page-spec `PageComponent` bridge input type but never copied onto the `SchemaNode` in `spec-bridge/bridges/page.ts::mapComponent()` — so a page author's ADR-0065 layout override (e.g. forcing `display: 'grid'` on a `type: 'flex'` band) never reached `SchemaRenderer`, and the node silently fell back to its default flex layout. Both fields are now mapped through.
    - `ObjectChart`'s dataset-bound fetch path (`schema.dataset` + `ds.queryDataset(...)`) discarded the response's `fields` array (which carries each measure's `label`, e.g. `{ name: 'task_count', label: 'Tasks' }`) before it ever reached `buildChartSeries()` — whose `fields` param already resolves this correctly (see `chart-series.test.ts`) — so the legend/tooltip always fell back to the raw field name. The fetched `fields` are now captured and threaded through.

- ec9c8ee: Fix master-detail record create: stop double success toast + localize the Cancel button.

  Objects with inline subforms (master-detail, e.g. a Lead with product line items)
  render `MasterDetailForm` inside `ModalForm`/`DrawerForm` instead of the plain
  footer, which exposed two mismatches with the host contract:

  - **Double success toast.** Flat `ObjectForm` delegates confirmation to the host
    when an `onSuccess` is supplied (skips its own default toast), but
    `MasterDetailForm.handleSaved` ALWAYS toasted `Created`/`Saved` AND ran
    `onSuccess`. In the console the host's `onSuccess` chains into the `crud_success`
    handler, which toasts a localized message — so create fired both `Created` and
    e.g. `线索创建成功`. `handleSaved` now only toasts as a fallback when no host
    `onSuccess` is provided, matching the `ObjectForm` contract; saves without a host
    handler stay non-silent.

  - **Hardcoded English `Cancel`.** The master-detail action bar wrote `Cancel` as a
    literal and accepted no `cancelText`, so the button stayed English while the
    submit button was localized (`submitText` was already forwarded).
    `MasterDetailForm` now takes `cancelText`, and `ModalForm`/`DrawerForm`/`ObjectForm`
    forward the host's localized label down the subforms branch.

  Adds regression tests: create with a host `onSuccess` fires no built-in toast (no
  double-confirm), and the Cancel button renders the host-supplied `cancelText`.

- 6c1ad9e: Record task flows open as derived overlays with lossless return (framework#2604, extends framework#2578).

  - **Create/Edit never route** — the global record form is URL-driven (`?form=new` / `?form=<id>`): browser Back closes the overlay with the origin (list scroll/filters, detail state) intact; field-heavy objects derive a full-screen modal (`modalSize:'full'`) via the new `deriveRecordFlowSurface` mirror in plugin-view, light ones keep the auto-sized modal. `editMode:'page'` opt-in unchanged.
  - **Save invariant** — _edit never moves you_ (origin refetches in place); _create lands on the new record's detail_ on its derived surface (drawer over the still-intact list for light objects, detail route for heavy), with `replace:true` so Back skips the transient form entry.
  - **Subtable child create/edit = overlay over the parent detail, never a route** — related-list New/Edit push `?form=…&formObject=<child>&formLink=<fk>:<parentId>`; the one global overlay pre-links the parent (refresh-safe), sizes to the CHILD object, and on save stays on the parent while only the child's related lists refetch. ModalForm now forwards `initialValues` into its master-detail (subforms) branch so pre-links survive for children with inline line items.

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/fields@11.5.0
  - @object-ui/core@11.5.0
  - @object-ui/permissions@11.5.0

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

- 144ab55: Consume the ADR-0085 object semantic roles from `@objectstack/spec@11.7.0`, retiring the per-surface hint dialects:

  - **Single-source fieldGroups derivation**: `plugin-form`'s `deriveFieldGroupSections` and `plugin-detail`'s `deriveFieldGroupDetailSections` are now thin adapters over the spec's `deriveFieldGroupLayout` (ADR-0085 §5) — forms, modals and detail pages render the SAME grouping from one implementation. The canonical `collapse: 'none' | 'expanded' | 'collapsed'` enum is honoured everywhere (deprecated `collapsible`/`collapsed` and `defaultExpanded` spellings still read for pre-11.7 metadata).
  - **`stageField` semantic role**: the detail stepper reads the top-level `stageField`; `stageField: false` now actually suppresses stage detection (previously the `false` handling was wired to the removed `detail.stageField` key, so spec-authored `false` fell through to the name heuristic).
  - **`highlightFields` rename**: default grid columns, card compact views, the detail highlight strip, child-record preview fields and interface-page default columns read the object's `highlightFields` (deprecated `compactLayout` spelling read as fallback for pre-11.7 metadata).
  - **Removed dead reads**: the never-spec-writable `objectDef.views.*` UI hints and the ADR-0085-removed `detail.*` block (`sections`, `sectionGroups`, `highlightFields`, `stageField`, `useFieldGroups`, `showReferenceRail`, `hideReferenceRail`, `hideRelatedTab`, `relatedLayout`) are no longer consulted. Per-page customization goes through an assigned Page schema (`record:reference_rail` remains available there as a renderer capability). `detail.renderViaSchema` survives only as the legacy-renderer kill-switch and is removed together with that path.

### Patch Changes

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

- 1e9145d: Hydrate widget types on hand-authored master-detail subform columns. A view can
  list a child grid's columns as bare `{ field, label }` (the common authoring
  form); previously such untyped columns were passed straight to the grid, so a
  `select` / `lookup` / `date` / `number` field silently rendered as a plain text
  cell. `MasterDetailForm` (and `deriveDetail`) now resolve each untyped column's
  `type` (plus `options` / `reference` / computed `expr`) from the child object's
  schema via the new `hydrateColumns` helper — a picklist becomes a dropdown, a
  lookup a record picker, a date a date input — while preserving the author's
  exact column set, order and labels. Columns that already declare a `type` are
  left untouched (the author's explicit choice still wins).
- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [9cd9be1]
- Updated dependencies [5160832]
- Updated dependencies [69d6b94]
- Updated dependencies [c38d107]
- Updated dependencies [243a9ba]
- Updated dependencies [289be5b]
- Updated dependencies [7782698]
- Updated dependencies [19f2533]
- Updated dependencies [790558b]
- Updated dependencies [09e1b26]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/fields@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/permissions@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0
  - @object-ui/permissions@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/fields@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0
  - @object-ui/permissions@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/fields@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/permissions@11.1.0

## 7.3.0

### Patch Changes

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/types@7.3.0
  - @object-ui/core@7.3.0
  - @object-ui/react@7.3.0
  - @object-ui/components@7.3.0
  - @object-ui/permissions@7.3.0

## 7.2.0

### Patch Changes

- 4aa8b84: fix(plugin-form): call `useRecordContext` unconditionally; drop impure render-time `Date.now()`

  `LineItemsPanel` wrapped `useRecordContext()` in a `try/catch`, which ESLint flagged
  as `react-hooks/rules-of-hooks` ("React Hook is called conditionally") — a genuine
  hook-order hazard if the `catch` ever fired part-way through render. `useRecordContext`
  returns `null` outside a `<RecordContextProvider>` and never throws, so the guard was
  dead code; it's now called unconditionally at the top level and the `null` case is
  handled by the existing optional chaining.

  Also clears a second pre-existing lint error: `EmbeddableForm` now seeds `mountedAtRef`
  from `0` instead of calling the impure `Date.now()` during render (the mount effect
  already overwrites it before any submit, so the anti-bot min-fill check is unchanged),
  fixing the react-compiler "Cannot call impure function during render" error. No
  behavior change.

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/permissions@7.2.0

## 7.1.0

### Patch Changes

- aae8791: Flow Screen preview: render inline master-detail subforms (follow-up to #1944)

  The object-form mode of the Screen-node preview now renders inline master-detail
  child grids, matching runtime. `ScreenPreview` feeds the SAME enriched object
  list the runtime `FlowRunner` uses (`useMetadata().objects`, which derives
  `form.subforms` from `inlineEdit` relationships via `attachInlineSubforms`), so
  e.g. a `showcase_invoice` object-form step previews its **Line Items** grid
  (with live Subtotal/Tax/Total) — only fetched in object-form mode.

  To keep the preview non-persisting — consistent with the flat-field preview
  (disabled Submit) and the simple object-form preview (no Save) — `MasterDetailForm`
  now honours a `showSubmit` flag (default shown; backward-compatible) that
  `ObjectForm` forwards, so the preview hides the master-detail Save bar. Also drops
  a dead `e = formData` assignment in `ObjectForm` (lint `no-useless-assignment`).

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/fields@7.1.0
  - @object-ui/permissions@7.1.0

## 7.0.0

### Minor Changes

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

- 80c133c: Spreadsheet-style line-item grid editor.

  `GridField`'s editable grid mode is reworked into an enterprise line-item editor (the QuickBooks / Stripe / NetSuite pattern), generalised across every inline grid:

  - **Computed read-only columns** — a child field with an arithmetic `expression` (e.g. `amount = quantity * unit_price`) renders read-only, recomputes live as its inputs change, and writes the result back into the row so it persists and the running total reflects it. A small safe arithmetic evaluator (`+ - * / %`, parens, `record.<field>` refs; no `eval`) powers it.
  - **Trailing "ghost" row** — start-with-one + auto-append: typing in the ghost materialises a real row (index-stable, so focus/caret survive), so you keep entering lines without clicking "Add".
  - **Borderless click-to-focus cells** + role-based column widths (description flexes; qty/price/amount stay narrow).
  - **Keyboard navigation** — Enter / ArrowUp / ArrowDown move between rows in the same column.
  - Per-row "expand to full form" is gated to grids that omit fields (no redundant expand on thin lines).
  - `deriveColumns` surfaces a field `expression` as a computed column; the running-total column prefers the computed/last-currency column. Blank/ghost rows are filtered from the persisted batch (`isBlankRow`).

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

- 69510df: feat(master-detail): derive child columns + relationship FK from metadata

  A master-detail child collection can now be configured with **just the child
  object name** — the relationship FK and the editable grid columns are derived
  from the child object's schema (via `DataSource.getObjectSchema`), instead of a
  hand-authored columns block.

  ```ts
  // before: ~40 lines of columns + relationshipField
  details: [{ childObject: 'task', relationshipField: 'project', columns: [ ...12 lines... ] }]
  // after:
  details: [{ childObject: 'task' }]
  ```

  - `relationshipField` is auto-detected from the child's `master_detail`/`lookup`
    field that references the parent (master_detail preferred).
  - `columns` are derived from the child's fields, skipping system/audit fields,
    the back-reference FK, and non-editable types (formula/summary/autonumber/
    file/json/…); select options and lookup references carry through.
  - `amountField` (running-total source) defaults to the first numeric/currency
    column.
  - Any of these can still be set explicitly to override the derived defaults.
  - Save is gated until derivation resolves; new pure helpers
    (`deriveDetail`/`deriveColumns`/`findRelationshipField`) are unit-tested.

- b148daf: feat(master-detail): atomic EDIT via the cross-object batch endpoint

  Edit mode now persists the parent update together with its child line-item
  create/update/delete diffs in ONE server transaction (commit all or roll back
  all), matching what create already did. Previously only create used the atomic
  `/api/v1/batch` path; edit fell back to client-orchestrated writes with
  best-effort cleanup.

  - New pure helper `buildMasterDetailEditBatch(parentObject, parentId,
parentData, details)` — emits a parent `update` op (index 0) then diffs each
    child collection against its loaded snapshot into `create` / `update` /
    `delete` ops (children reference the known parent id directly, no `$ref`).
  - `MasterDetailForm` now treats `canBatch` as available whenever the data
    source exposes `batchTransaction` (create AND edit). `submitViaBatch` builds
    create-ops or edit-ops by mode; `onSuccess` → `handleSaved` ("saved" toast,
    no form reset in edit).

  The server `/api/v1/batch` handler already supports `update`/`delete` actions,
  and the adapter already forwards `action`/`id`, so this is a front-end change.
  Unit-tested (parent update + child create/update/delete diff); the create path
  remains verified by the live e2e.

- 90acb7f: Master-detail subform + lightweight list primitives (SDUI).

  - `MasterDetailForm` (`object-master-detail-form`): enter a parent record and its child line items together; client-orchestrated transactional create (parent → FK → bulk children → rollup → cleanup). Enterprise-convention layout (header on top, line grid, single Save bar at the bottom).
  - `LineItemsField` editable child grid (line numbers, right-aligned numerics, running total) and `LineItemsPanel` (`record:line_items`) for detail-page inline edit.
  - `element:definition-list` and `element:repeater` — lightweight, low-chrome list primitives for simple data.

- 00f8d2d: Master-detail form: live Subtotal / Tax / Total stack.

  `MasterDetailForm` now renders a right-aligned document totals stack under the line items when the parent form has a tax-rate field (`taxRateField`, default `tax_rate`): **Subtotal** (Σ line amounts) → **Tax** (header rate %) → **Total**, recomputed live as lines and the rate change. The header rate is read via scoped event delegation on the form host (no coupling into `ObjectForm` internals). When the stack is shown, the per-grid footer total is subsumed.

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

- 18728c1: Master-detail entry: lighter layout, compact lookup cells, persisted line order.

  - **De-framed line-item section** — the subform no longer double-frames the grid in a `Card` (border + `p-6`); it renders as a light label + the grid's own bordered table, reclaiming the width the line table needs.
  - **Compact lookup cells** — `LookupField` gains a `compact` mode (used by grid cells): the selected value shows inline in a borderless single-line trigger instead of a chip stacked above a separate "Select…" button.
  - **Persisted drag-reorder** — `deriveMasterDetail` detects a sort field (`position`/`sort_order`/…), excludes it from the editable columns/row-form, and threads it as the grid's `sort_field` so reordering stamps `row[position] = index` and survives a reload.

- 8426db7: feat(form): standard New/Edit modal renders form-view subforms (Tier 0)

  The console's standard create/edit record modal now renders inline child
  collections when the object's form view declares `subforms` — master-detail
  entry with **no bespoke page**, persisted as one atomic transaction.

  - `ModalForm` (and the create/edit modal in app-shell `AppContent`) detects
    `subforms` and renders `MasterDetailForm` inside the dialog (it owns its Save
    bar; the modal footer is suppressed); on success the modal closes + refreshes.
  - `AppContent` sources `subforms` from the object's default form view
    (`form.subforms` / `formViews.default.subforms`).
  - `ModalFormSchema` gains `subforms`.

  With this, declaring `formViews.default.subforms: [{ childObject }]` is enough
  to make an object's standard New/Edit screen a master-detail form — completing
  the config-driven master-detail story (Tier 0 → derive everything from the
  relationship + child metadata).

### Patch Changes

- ddbe4a2: B2 step 3: client-side field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`). The form renderer now evaluates these CEL predicates reactively against the live record and gates each field's visibility, read-only state, and required-ness accordingly. Evaluation delegates to the canonical `@objectstack/formula` `ExpressionEngine` — the _same_ dialect the server enforces (`requiredWhen` in the rule-validator, `readonlyWhen` in `stripReadonlyWhenFields`) — so the UX and the persisted verdict always agree. New core helpers `evalFieldPredicate` / `resolveFieldRuleState` (zero-React, fail-open). `FormField` gains `visibleWhen` / `readonlyWhen` / `requiredWhen` (+ deprecated `conditionalRequired` alias), and `ObjectForm` carries them through from object metadata.
- 2d47e94: B2 follow-ups (A): field conditional rules in inline grids + submit-time enforcement.

  - **Grids**: a line-item column's `readonlyWhen` / `requiredWhen` CEL rule is now honored per row — `deriveMasterDetail` carries the props onto the `GridColumn` and `GridField` evaluates them against each row via `resolveFieldRuleState` (a `readonlyWhen`-TRUE cell locks; a `requiredWhen`-TRUE empty cell flags inline-invalid). Rules are row-scoped (`record.*`); the core helpers gained an optional `scope` (and `GridField` a `contextRecord` prop) so a future header-driven lock can bind `parent.*` — that wiring is deferred (it needs the master-detail header's re-renders isolated).
  - **Submit enforcement**: `requiredWhen` already drove react-hook-form's `required` rule, so submit is blocked with a field error when the predicate is TRUE and the value is empty. Added a reactive cleanup so a stale _required_ error clears when the predicate flips FALSE (and all errors clear when a field is hidden by `visibleWhen`).

- f6044fa: feat(form): subforms in DrawerForm + full-page record form (Tier 0 everywhere)

  Completes config-driven master-detail across all standard create/edit entry
  points (after the modal in the previous change):

  - `DrawerForm` now hosts `MasterDetailForm` inside the drawer when the schema
    declares `subforms` (its own Save bar; closes + refreshes on success).
  - `RecordFormPage` (full-page New/Edit) sources `subforms` from the object's
    form view, so the full-page form renders inline child collections too.
  - `ObjectForm`'s subforms shortcut now defers to the drawer/modal variants for
    those formTypes (so they keep their envelope), and only renders the
    master-detail form directly for inline/simple forms.

  Declaring `formViews.default.subforms: [{ childObject }]` now yields a
  master-detail experience in the modal, drawer, AND full-page form — no bespoke
  page anywhere.

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

- 7913390: fix(master-detail): never silent on save — feedback, reset, and a duplicate-submit guard

  `MasterDetailForm`'s "Create" submitted successfully but gave **no feedback**: no toast, no form reset, no navigation. A successful create looked broken, and re-clicking created duplicate records.

  - On success: a `toast.success`, and on create the form clears (line items reset + parent `<ObjectForm>` remounts) ready for the next entry. A page-supplied `onSuccess` still runs afterwards (e.g. to navigate).
  - On failure (validation / network / atomic rollback): a `toast.error` surfaces the message instead of failing silently.
  - In-flight guard: the Create button shows "Saving…" and is disabled while a submit is running, preventing duplicate submissions, with a safety release if client-side validation blocks the submit.
  - `@object-ui/components` now re-exports `toast` (alongside `Toaster`) from its sonner wrapper.

  Tests: two new `MasterDetailForm` tests assert success → toast + form clear, and failure → error toast.

- 514f426: fix(master-detail): reliable submit + stable e2e hooks

  Fixes the "click Create, nothing happens" report, surfaced by a new live browser
  e2e harness that drives the form with real input.

  - **MasterDetailForm `handleSave`** now triggers the button-less parent form's
    submit from a deferred macrotask and re-queries the live `<form>` inside it.
    Calling `requestSubmit()` synchronously inside the click handler (right after
    the `setSaving` state update) intermittently dropped the nested submit event,
    so react-hook-form's `onSubmit` never ran and the click appeared to do nothing
    — only the occasional click got through. Deferring makes it fire every time.
  - **Stable `data-testid`s** so automation/e2e can drive the widgets
    deterministically (Radix Select + react-hook-form cannot be driven by
    synthetic DOM events): `select-trigger-{field}` / `select-option-{value}`
    (SelectField), `lookup-trigger-{field}` (LookupField), `line-items-add`
    (GridField), `md-form-submit` / `md-form-cancel` (MasterDetailForm).

- 586a027: B2 follow-up (#1581): parent-scoped conditional rules in inline grids — "paid invoice → lock lines". `MasterDetailForm` now binds the live header record to every line-item grid as `parent`, so a column's `readonlyWhen` / `requiredWhen` CEL rule can react to the header (e.g. `parent.status == 'paid'` locks quantity / unit price / product when the invoice is paid). The line grids + document totals moved into a dedicated `<MasterDetailLines>` child that owns the scraped header record, so a header edit re-renders only the lines and never resets the header `ObjectForm`'s react-hook-form state mid-edit; the scrape is deduped by value to avoid needless churn. (`@object-ui/fields`' `GridField.contextRecord` and column-rule derivation already existed — this wires the last link.)
- 9aac2b8: feat(form): modal forms can host a tabbed layout (modal + tabbed composes)

  `ModalForm` rendered sections as a flat vertical stack — a modal create/edit
  form could never be tabbed, because `formType` (one field) couldn't be both
  `modal` (container) and `tabbed` (layout). Per ADR-0050 (additive first), the
  modal container now accepts a `contentLayout` ('simple' | 'tabbed'): when
  `tabbed`, sections render as tabs inside the dialog. The console record
  New/Edit modal (`AppContent`) forwards the default form view's layout, so a
  `type:'tabbed'` form view now renders tabbed in the modal too — not just on the
  full-page route (#1762). Non-breaking; `FormView.type` enum unchanged.

  Refs objectstack-ai/framework#1890, ADR-0050

- 650bd1f: fix(forms/dashboard/related-list): four business-facing rendering fixes found while QA-ing a showcase workspace

  - **plugin-form / WizardForm**: a multi-step `object-form` with `formType: 'wizard'` posted an empty/partial body on submit, so the server rejected every required field. Two causes: (1) the footer Next/Create buttons bypassed the inner form and submitted the wizard's own (never-collected) `formData`; (2) the create-mode data-seeding effect re-ran on `dataSource`/`objectSchema` identity churn and reset `formData` to `{}` mid-wizard. Now the buttons submit the inner form natively (`<form id>` + `type="submit"`, which validates each step and collects values via `getValues()`), and the create seed is made idempotent.
  - **plugin-dashboard / DashboardRenderer**: chart widgets rendered as empty cards (recharts logged `width(-1) height(-1)`) because the positioned grid used `auto-rows-min`, collapsing any widget with no intrinsic height. The explicit-columns grid now uses `gridAutoRows: minmax(5rem, auto)` so spanned chart rows get a real height while tables can still grow.
  - **plugin-detail / RelatedList**: auto-derived related-list columns led with system audit fields (`created_at`, `updated_at`, …) for child objects without a name/title field, pushing business columns past the column cap. System audit fields are now sorted last.
  - **plugin-form / ObjectForm + WizardForm**: a successful create/update gave no feedback for metadata-only pages (which can't pass an `onSuccess` function). They now show a default `toast.success('Created'/'Saved')` when no `onSuccess` handler is supplied (guarded so a `submitHandler` host like MasterDetailForm never double-toasts).

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [6c0c92c]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [bd398df]
- Updated dependencies [66ed3ad]
- Updated dependencies [c6445b6]
- Updated dependencies [80c133c]
- Updated dependencies [5e1b838]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [514f426]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [db8cd00]
- Updated dependencies [18728c1]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/fields@7.0.0
  - @object-ui/permissions@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/fields@6.2.3
- @object-ui/permissions@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/permissions@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/fields@6.2.1
- @object-ui/permissions@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/fields@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0
- @object-ui/permissions@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/permissions@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/fields@6.0.4
- @object-ui/permissions@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/fields@6.0.3
- @object-ui/permissions@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/fields@6.0.2
- @object-ui/permissions@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/fields@6.0.1
- @object-ui/permissions@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/permissions@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/fields@5.4.2
- @object-ui/permissions@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/fields@5.4.1
- @object-ui/permissions@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/permissions@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2
- @object-ui/permissions@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1
- @object-ui/permissions@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/permissions@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/fields@5.2.1
- @object-ui/permissions@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/permissions@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/react@5.1.1
  - @object-ui/permissions@5.1.1

## 5.1.0

### Minor Changes

- c0b236f: Platform detail/form polish:
  - **Auto-section grouping**: When an object has no authored `views.form.sections`, the detail page now splits fields into a primary section and a collapsible "More details" section based on a field-type/name heuristic (textarea / markdown / description / notes / remarks). Eliminates the wall-of-fields layout on objects without explicit detail metadata.
  - **FormSection card chrome**: `FormSection` now accepts `showBorder`. Defaults to `true` for titled sections (Card wrapper) and `false` for untitled sections (flat). Same auto-default already applied to `DetailSection`.
  - **Origin breadcrumb**: Navigating from a list/kanban into a record now records the source view; the detail page shows a `← <view label>` back-link above the page header.
  - New i18n key `detail.sectionMoreDetails` (en + zh-CN).

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/fields@5.1.0
  - @object-ui/permissions@5.1.0

## 5.0.2

### Patch Changes

- a311e22: Fix EmbeddableForm rendering no inputs on the public-form path. When the
  caller passes a `fields: string[]` list (e.g. the response from
  `GET /api/v1/forms/:slug`) the inner `ObjectForm` now receives a
  read-only wrapper of the data source — preserving `getObjectSchema()`
  so it can materialise widgets, while neutralising mutating ops so all
  backend writes still go through `EmbeddableForm.handleSubmit` (and its
  consent / honeypot / min-fill / redirect / payload-sanitisation gates).
  - @object-ui/components@5.0.2
  - @object-ui/fields@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/permissions@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/fields@5.0.1
- @object-ui/permissions@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bb2ea48]
- Updated dependencies [b14fe09]
- Updated dependencies [a7bef6e]
- Updated dependencies [74962b0]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
  - @object-ui/components@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/core@5.0.0
  - @object-ui/permissions@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0
- @object-ui/permissions@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/permissions@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0
  - @object-ui/permissions@4.6.0

## 4.5.0

### Patch Changes

- 6b6afd1: ModalForm / SplitForm / WizardForm now honor field-level `visibleOn` (CEL
  expression on inline fields) and `visible_on` (object schema mirror) inside
  their section-mode rendering. Previously only flat-field forms via ObjectForm
  respected the expression; section-mode dropped it so conditional fields
  always rendered.
- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/permissions@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [63eb66d]
- Updated dependencies [2bd45af]
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0
  - @object-ui/permissions@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/permissions@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/fields@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/fields@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/fields@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/fields@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/fields@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/fields@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/fields@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/fields@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- 89ae109: Fix click navigation and required-FK form rendering
  - **plugin-grid**: ObjectGrid's `getSelectFields()` now always includes `id` in
    the SELECT projection. Previously, when a view configured `columns` without
    `id`, the SQL driver stripped it from results, and row-click handlers silently
    no-oped because `record.id` was undefined.
  - **plugin-form / fields**: Master-detail fields now render as a single-value
    lookup picker (`LookupField`) in create/edit forms instead of a one-to-many
    related-list widget. From the child-side, master-detail is the FK to the
    parent record and is typically NOT NULL — it must appear in forms. Prior
    behavior dropped it via the auto-layout exclusion list, which caused server
    errors like "NOT NULL constraint failed: contact.account" when users tried
    to create child records.

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/fields@4.0.6
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/react@4.0.6

## 4.0.5

### Patch Changes

- 1dc6061: fix(build): inline dynamic imports in library outputs

  Library `vite build --lib` outputs were emitting separate code-split chunks
  (`rolldown-runtime-*.js`, `LookupField-*.js`, etc.) when source files used
  `React.lazy()` / dynamic `import()`. When consumer apps re-bundled these
  multi-file dists, the library's per-chunk rolldown-runtime collided with the
  consumer's own runtime, causing "TypeError: i is not a function" at runtime
  when lazy components tried to register themselves (e.g. TextField in
  `@object-ui/fields` after 4.0.4).

  Adding `output.inlineDynamicImports: true` to all `@object-ui/*` library vite
  configs forces a single `dist/index.js` per package, which lets consumer
  bundlers handle the library as an opaque ESM module without identifier
  mismatches across chunks.

  Affected packages: components, fields, layout, plugin-aggrid, plugin-ai,
  plugin-calendar, plugin-charts, plugin-chatbot, plugin-dashboard,
  plugin-designer, plugin-detail, plugin-editor, plugin-form, plugin-gantt,
  plugin-grid, plugin-kanban, plugin-list, plugin-map, plugin-markdown,
  plugin-report, plugin-timeline, plugin-view, plugin-workflow.

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/fields@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/react@4.0.5

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:
  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/fields@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/react@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3
  - @object-ui/fields@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

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

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/fields@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/fields@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/fields@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/fields@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/fields@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4
- @object-ui/fields@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3
- @object-ui/fields@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2
- @object-ui/fields@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/fields@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3
- @object-ui/fields@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2
- @object-ui/fields@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/fields@3.0.1
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
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0
  - @object-ui/fields@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0
  - @object-ui/fields@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
  - @object-ui/fields@0.3.1
