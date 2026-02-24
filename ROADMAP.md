# ObjectUI Development Roadmap

> **Last Updated:** February 24, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.9
> **Client Version:** @objectstack/client v3.0.9
> **Target UX Benchmark:** 🎯 Airtable parity
> **Current Priority:** AppShell Navigation · Designer Interaction · View Config Live Preview Sync · Dashboard Config Panel · Airtable UX Polish · **Flow Designer ✅** · **App Creation & Editing Flow ✅** · **System Settings & App Management ✅** · **Right-Side Visual Editor Drawer ✅**

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** Foundation is **solid and shipping** — 35 packages, 99+ components, 6,500+ tests, 80 Storybook stories, 43/43 builds passing, ~85% protocol alignment. SpecBridge, Expression Engine, Action Engine, data binding, all view plugins (Grid/Kanban/Calendar/Gantt/Timeline/Map/Gallery), Record components, Report engine, Dashboard BI features, mobile UX, i18n (11 locales), WCAG AA accessibility, Designer Phase 1 (ViewDesigner drag-to-reorder ✅), Console through Phase 20 (L3), **AppShell Navigation Renderer** (P0.1), **Flow Designer** (P2.4), **Feed/Chatter UI** (P1.5), **App Creation & Editing Flow** (P1.11), **System Settings & App Management** (P1.12), **Page/Dashboard Editor Console Integration** (P1.11), and **Right-Side Visual Editor Drawer** (P1.11) — all ✅ complete.

**What Remains:** The gap to **Airtable-level UX** is primarily in:
1. ~~**AppShell** — No dynamic navigation renderer from spec JSON (last P0 blocker)~~ ✅ Complete
2. **Designer Interaction** — ViewDesigner and DataModelDesigner have undo/redo, field type selectors, inline editing, Ctrl+S save, column drag-to-reorder with dnd-kit ✅
3. **View Config Live Preview Sync** — Config panel changes sync in real-time for Grid, but `showSort`/`showSearch`/`showFilters`/`striped`/`bordered` not yet propagated to Kanban/Calendar/Timeline/Gallery/Map/Gantt (see P1.8.1)
4. **Dashboard Config Panel** — Airtable-style right-side configuration panel for dashboards (data source, layout, widget properties, sub-editors, type definitions)
5. **Console Advanced Polish** — Remaining upgrades for forms, import/export, automation, comments
6. **PWA Sync** — Background sync is simulated only

---

## 🔄 Spec v3.0.9 Upgrade Summary

> Upgraded from `@objectstack/spec v3.0.8` → `v3.0.9` on February 22, 2026. UI sub-export is unchanged; changes are in Automation, Kernel, Data, and API layers.

**New Protocol Capabilities (v3.0.9):**

| Area | What's New | Impact on ObjectUI |
|------|------------|-------------------|
| **Workflow Nodes** | `parallel_gateway`, `join_gateway`, `boundary_event` node types | ProcessDesigner (P2.1) & Automation builder (P1.6) |
| **BPMN Interop** | `BpmnImportOptions`, `BpmnExportOptions`, `BpmnInteropResult`, `BpmnElementMapping` | plugin-workflow BPMN import/export (P2.4) |
| **Wait/Timer Executors** | `WaitEventType` (condition/manual/webhook/timer/signal), `WaitExecutorConfig`, `WaitTimeoutBehavior` | Automation builder wait-step UI (P1.6) |
| **Execution Tracking** | `ExecutionLog`, `ExecutionStepLog`, `Checkpoint`, `ExecutionError`, `ExecutionStatus` | Automation execution history (P1.6) |
| **Flow Edges** | `conditional` edge type, `isDefault` flag | ProcessDesigner conditional routing (P2.1) |
| **Retry Config** | `backoffMultiplier`, `maxRetryDelayMs`, `jitter` on retry policy | Automation retry settings UI (P1.6) |
| **Flow Versioning** | `FlowVersionHistory`, `ConcurrencyPolicy`, `ScheduleState` | Flow version management & scheduling (P1.6) |
| **Data Export** | `ExportFormat`, `ExportJobStatus`, `CreateExportJobRequest` (export.zod) | Import/Export feature (P1.3) |
| **App Engine** | Optional `engine: { objectstack: string }` on App config | Version pinning support (P2.4) |
| **Package Upgrade** | `PackageArtifact`, `ArtifactChecksum`, `UpgradeContext`, `DependencyStatus` | Package management (P2.4) |
| **Kernel Enhancements** | `PluginBuildOptions`, `PluginPublishOptions`, `PluginValidateOptions`, `MetadataCategory`, `NamespaceConflictError` | Plugin development tooling (P2.4) |

**UI Sub-Export:** No breaking changes — `@objectstack/spec/ui` types are identical between v3.0.8 and v3.0.9.

---

## 🎯 P0 — Must Ship (v1.0 Blockers)

### P0.1 AppShell & Navigation Renderer

> **Last remaining P0 blocker.** Without this, Console cannot render a sidebar from `AppSchema` JSON.

- [x] Implement `AppSchema` renderer consuming spec JSON (name, label, icon, branding)
- [x] Build navigation tree renderer (7 nav item types: object, dashboard, page, url, report, action, group)
- [x] Implement `NavigationAreaSchema` support (business domain partitioning)
- [x] Implement mobile navigation modes (drawer/bottom_nav/hamburger)
- [x] Add permission guards (`requiredPermissions`, `visible`) on navigation items

---

## 🎯 P1 — UI-First: Airtable UX Parity

> **Priority #1.** All items below directly affect end-user experience. Target: indistinguishable from Airtable for core CRUD workflows.

### P1.1 Designer Interaction (ViewDesigner + DataModelDesigner)

> Source: ROADMAP_DESIGNER Phase 2. These two designers are the core user workflow.

**ViewDesigner:**
- [x] Column drag-to-reorder via `@dnd-kit/core` (replace up/down buttons with drag handles)
- [x] Add `Ctrl+S`/`Cmd+S` keyboard shortcut to save
- [x] Add field type selector dropdown with icons from `DESIGNER_FIELD_TYPES`
- [x] Column width validation (min/max/pattern check)

**DataModelDesigner:**
- [x] Entity drag-to-move on canvas
- [x] Inline editing for entity labels (click to edit)
- [x] Field type selector dropdown (replaces hardcoded `'text'` type)
- [x] Confirmation dialogs for destructive actions (delete entity cascades to relationships)

**Shared Infrastructure:**
- [x] Implement `useDesignerHistory` hook (command pattern with undo/redo stacks)
- [x] Wire undo/redo to ViewDesigner and DataModelDesigner

### P1.2 Console — Forms & Data Collection

- [x] ModalForm responsive optimization: sections layout auto-upgrades modal size, slider for percent/progress fields, tablet 2-column layout
- [ ] Camera capture for mobile file upload
- [ ] Image cropping/rotation in file fields
- [ ] Cloud storage integration (S3, Azure Blob) for file upload
- [ ] Upload resume on network failure
- [ ] Advanced lookup: dependent lookups (filter based on other fields)
- [ ] Hierarchical lookups (parent-child relationships)
- [ ] Lookup result caching
- [ ] Form conditional logic with branching
- [ ] Multi-page forms with progress indicator

### P1.3 Console — Import/Export Excellence

> **Spec v3.0.9** introduces a formal Data Export/Import Protocol (`export.zod`) with streaming export, import validation, field mapping templates, and scheduled export jobs.

- [ ] Excel (XLSX) export with formatting
- [ ] PDF export with custom formatting
- [ ] Export all data (not just visible rows)
- [ ] Custom column selection for export
- [ ] Scheduled exports via automation
- [ ] Export templates with custom formatting
- [ ] Import field mapping UI (map CSV columns to object fields)
- [ ] Import validation preview with error correction
- [ ] Duplicate detection during import
- [ ] Integrate spec v3.0.9 `ExportFormat` enum (json, csv, xlsx, jsonl, parquet)
- [ ] Integrate spec v3.0.9 `CreateExportJobRequest` / `ExportJobStatus` for async streaming exports
- [ ] Import template-based field mapping using spec protocol schemas

### P1.4 Console — Undo/Redo & History

- [ ] Cross-session undo stack persistence (survive page refresh)
- [ ] Undo grouping (batch multiple field changes as one undo step)
- [ ] Visual undo history panel (timeline of changes)
- [ ] Undo/redo for bulk operations

### P1.5 Console — Comments & Collaboration

- [x] @mention notification delivery (email/push)
- [x] Comment search across all records
- [x] Comment pinning/starring
- [x] Activity feed filtering (comments only / field changes only)
- [x] Airtable-style Feed/Chatter UI components (P0/P1/P2):
  - [x] `FeedItem`/`FieldChangeEntry`/`Mention`/`Reaction`/`RecordSubscription` types
  - [x] `RecordActivityTimeline` — unified timeline renderer (filter, pagination, actor display)
  - [x] `RecordChatterPanel` — sidebar/inline/drawer panel (collapsible)
  - [x] `CommentInput` — comment input with Ctrl+Enter submit
  - [x] `FieldChangeItem` — field change history (old→new display values)
  - [x] `MentionAutocomplete` — @mention autocomplete dropdown
  - [x] `SubscriptionToggle` — bell notification toggle
  - [x] `ReactionPicker` — emoji reaction selector
  - [x] `ThreadedReplies` — collapsible comment reply threading
  - [x] Comprehensive unit tests for all 6 core Feed/Chatter components (96 tests)
  - [x] Console `RecordDetailView` integration: `CommentThread` → `RecordChatterPanel` with `FeedItem[]` data model
  - [ ] Documentation for Feed/Chatter plugin in `content/docs/plugins/plugin-detail.mdx` (purpose/use cases, JSON schema, props, and Console integration for `RecordChatterPanel`, `RecordActivityTimeline`, and related components)
### P1.6 Console — Automation

> **Spec v3.0.9** significantly expanded the automation/workflow protocol. New node types, BPMN interop, execution tracking, and wait/timer executors are now available in the spec.

- [ ] Multi-step automation builder (if-then chains)
- [ ] Scheduled automations (cron-based triggers)
- [ ] Webhook triggers and actions
- [ ] Email notification actions
- [ ] Automation execution history and logs
- [ ] Support new v3.0.9 workflow node types: `parallel_gateway`, `join_gateway`, `boundary_event`
- [ ] BPMN import/export interop (spec provides `BpmnImportOptions`, `BpmnExportOptions`, `BpmnInteropResult`)
- [ ] Wait/timer executor UI (`waitEventConfig`: condition, manual, webhook, timer, signal events)
- [ ] Execution tracking dashboard (`ExecutionLog`, `ExecutionStepLog`, `Checkpoint`, `ExecutionError`)
- [ ] Conditional edge support (`conditional` edge type, `isDefault` flag on edges)
- [ ] Enhanced retry configuration UI (`backoffMultiplier`, `maxRetryDelayMs`, `jitter`)
- [ ] Flow version history viewer (`FlowVersionHistory`)
- [ ] Concurrency policy configuration (`ConcurrencyPolicy`)

### P1.7 Console — Navigation Enhancements

- [x] AppShell `AppSchema` renderer (spec-driven sidebar from JSON)
- [x] Area switcher with grouped navigation
- [x] User-customizable sidebar (drag reorder, pin favorites)
- [x] Search within sidebar navigation
- [x] Console integration: Navigation search filtering (`filterNavigationItems` + `SidebarInput`)
- [x] Console integration: Badge indicators on navigation items (`badge` + `badgeVariant`)
- [x] Console integration: Drag reorder upgrade — replace HTML5 DnD with `@dnd-kit` via `NavigationRenderer`
- [x] Console integration: Navigation pin — `useNavPins` hook + `NavigationRenderer` `enablePinning`/`onPinToggle`
- [x] Console integration: `AppSchemaRenderer` slot system — `sidebarHeader`, `sidebarExtra`, `sidebarFooter` slots for Console customization
- [x] Navigation Sync Service — `useNavigationSync` hook auto-syncs App navigation tree on Page/Dashboard CRUD (create, delete, rename) with toast + undo
- [x] Navigation Sync auto-detection — `NavigationSyncEffect` component monitors metadata changes and auto-syncs navigation across ALL apps when pages/dashboards are added or removed
- [x] Navigation Sync all-apps convenience API — `sync*AllApps` methods iterate all apps without requiring explicit `appName`

### P1.8 Console — View Config Panel (Phase 20)

- [x] Inline ViewConfigPanel for all view types (Airtable-style right sidebar)
- [x] Column visibility toggle from config panel
- [x] Column reorder (move up/down) from config panel with real-time preview
- [x] Sort/filter/group config from right sidebar
- [x] Type-specific options in config panel (kanban/calendar/map/gallery/timeline/gantt)
- [x] Unified create/edit mode (`mode="create"|"edit"`) — single panel entry point
- [x] Unified data model (`UnifiedViewConfig`) for view configuration
- [x] ViewDesigner retained as "Advanced Editor" with weaker entry point
- [x] Panel header breadcrumb navigation (Page > List/Kanban/Gallery)
- [x] Collapsible/expandable sections with chevron toggle
- [x] Data section: Sort by (summary), Group by, Prefix field, Fields (count visible)
- [x] Appearance section: Color, Field text color, Row height (icon toggle), Wrap headers, Show field descriptions, Collapse all by default
- [x] User actions section: Edit records inline (→ inlineEdit), Add/delete records inline, Navigation mode (page/drawer/modal/split/popover/new_window/none)
- [x] Calendar endDateField support
- [x] i18n for all 11 locales (en, zh, ja, de, fr, es, ar, ru, pt, ko)
- [ ] **Live preview: ViewConfigPanel changes sync in real-time to all list types (Grid/Kanban/Calendar/Timeline/Gallery/Map)** _(partially complete — see P1.8.1 gap analysis below)_
  - ✅ `showSort` added to `ObjectViewSchema` and propagated through plugin-view (Grid only)
  - ✅ Appearance properties (`rowHeight`, `densityMode`) flow through `renderListView` schema for all view types
  - ✅ `gridSchema` in plugin-view includes `striped`/`bordered` from active view config (Grid only)
  - ✅ Plugin `renderContent` passes `rowHeight`, `densityMode`, `groupBy` to `renderListView` schema
  - ✅ `useMemo` dependency arrays expanded to cover full view config
  - ✅ `generateViewSchema` propagates `showSearch`/`showSort`/`showFilters`/`striped`/`bordered`/`color` from `activeView` for all view types (hardcoded `showSearch: false` removed)
  - ✅ Console `renderListView` passes `showSort`/`showSearch`/`showFilters`/`striped`/`bordered`/`color`/`filter`/`sort` to `fullSchema`
  - ✅ `NamedListView` type declares `showSearch`/`showSort`/`showFilters`/`striped`/`bordered`/`color` as first-class properties
  - ✅ `ListViewSchema` TypeScript interface and Zod schema include `showSearch`/`showSort`/`showFilters`/`color`
  - ✅ ViewConfigPanel refactored into Page Config (toolbar/shell) and ListView Config (data/appearance) sections
  - ✅ `NamedListView` type extended with 24 new properties: navigation, selection, pagination, searchableFields, filterableFields, resizable, densityMode, rowHeight, hiddenFields, exportOptions, rowActions, bulkActions, sharing, addRecord, conditionalFormatting, quickFilters, showRecordCount, allowPrinting, virtualScroll, emptyState, aria
  - ✅ `ListViewSchema` Zod schema extended with all new properties
  - ✅ ViewConfigPanel aligned to full `ListViewSchema` spec: navigation mode, selection, pagination, export sub-config, searchable/filterable/hidden fields, resizable, density mode, row/bulk actions, sharing, addRecord sub-editor, conditional formatting, quick filters, showRecordCount, allowPrinting, virtualScroll, empty state, ARIA accessibility
  - ✅ Semantic fix: `editRecordsInline` → `inlineEdit` field name alignment (i18n keys, data-testid, component label all unified to `inlineEdit`)
  - ✅ Semantic fix: `rowHeight` values aligned to full spec — all 5 RowHeight enum values (`compact`/`short`/`medium`/`tall`/`extra_tall`) now supported in NamedListView, ObjectGridSchema, ListViewSchema, Zod schema, UI, and ObjectGrid rendering (cell classes, cycle toggle, icon mapping)
  - ✅ `clickIntoRecordDetails` toggle added to UserActions section (NamedListView spec field — previously only implicit via navigation mode)
  - ✅ **Strict spec-order alignment**: All fields within each section reordered to match NamedListView property declaration order:
    - PageConfig: showSort before showFilters; allowExport before navigation (per spec)
    - Data: columns → filter → sort (per spec); prefixField after sort
    - Appearance: striped/bordered first, then color, wrapHeaders, etc. (per spec)
    - UserActions: inlineEdit before clickIntoRecordDetails (per spec)
  - ✅ **Spec source annotations**: Every field annotated with `// spec: NamedListView.*` or `// UI extension` comment
  - ✅ **Protocol suggestions documented**: description, _source, _groupBy, _typeOptions identified as UI extensions pending spec addition
  - ✅ **Comprehensive spec field coverage test**: All 44 NamedListView properties verified mapped to UI fields; field ordering validated per spec
  - ✅ i18n keys verified complete for en/zh and all 10 locale files
  - ✅ Console ObjectView fullSchema propagates all 18 new spec properties
  - ✅ PluginObjectView renderListView schema propagates all 18 new spec properties
  - ✅ Per-view-type integration tests added for Grid/Kanban/Calendar/Timeline/Gantt/Gallery/Map config sync (Phase 7 complete)
- [x] Conditional formatting rules (editor in Appearance section)

### P1.8.1 Live Preview — Gap Analysis & Phased Remediation

> **Ref:** Issue [#711](https://github.com/objectstack-ai/objectui/issues/711) — Right-side view config panel changes not syncing in real-time to all list types.

**Current Config Property Propagation Matrix:**

| Property | Grid | Kanban | Calendar | Timeline | Gallery | Map | Gantt |
|----------|:----:|:------:|:--------:|:--------:|:-------:|:---:|:-----:|
| `showSearch` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `showSort` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `showFilters` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `showHideFields` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `showGroup` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `showColor` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `showDensity` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `allowExport` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `rowHeight` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `densityMode` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `striped` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bordered` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `groupBy` | N/A | ✅ | N/A | N/A | N/A | N/A | N/A |
| `color` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `filter`/`sort` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Type-specific options | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Root Causes (resolved):**
1. ~~**`generateViewSchema` (plugin-view):** Hardcodes `showSearch: false` for non-grid views~~ → Now propagates from `activeView`
2. ~~**Console `renderListView`:** Omits toolbar/display flags from `fullSchema`~~ → Now passes all config properties
3. ~~**`NamedListView` type:** Missing toolbar/display properties~~ → Added as first-class properties
4. ~~**Plugin `renderListView` schema missing toolbar flags:** `renderContent` → `renderListView` schema did not include `showSearch`/`showFilters`/`showSort`~~ → Now propagated (PR #771)
5. ~~**ListView toolbar unconditionally rendered:** Search/Filter/Sort buttons always visible regardless of schema flags~~ → Now conditionally rendered based on `schema.showSearch`/`showFilters`/`showSort` (PR #771); `userActions.sort`/`search`/`filter`/`rowHeight`/`addRecordForm` now override toolbar flags (Issue #737)
6. ~~**Hide Fields/Group/Color/Density buttons always visible:** No schema property to control visibility~~ → Added `showHideFields`/`showGroup`/`showColor`/`showDensity` with conditional rendering (Issue #719)
7. ~~**Export toggle broken:** ViewConfigPanel writes `allowExport: boolean` but ListView checks `exportOptions` object~~ → Export now checks both `exportOptions && allowExport !== false`; Console clears `exportOptions` when `allowExport === false` (Issue #719)
8. ~~**`hasExport` logic bug:** `draft.allowExport !== false` was always true when undefined~~ → Fixed to `draft.allowExport === true || draft.exportOptions != null` (Issue #719)
9. **No per-view-type integration tests:** Pending — tests verify config reaches `fullSchema`, but per-renderer integration tests still needed

**Phase 1 — Grid/Table View (baseline, already complete):**
- [x] `gridSchema` includes `striped`/`bordered` from `activeView`
- [x] `showSort`/`showSearch`/`showFilters` passed via `ObjectViewSchema`
- [x] `useMemo` dependency arrays cover all grid config
- [x] ListView toolbar buttons conditionally rendered based on `schema.showSearch`/`showFilters`/`showSort` (PR #771)
- [x] `renderListView` schema includes toolbar toggle flags (`showSearch`/`showFilters`/`showSort`) and display props (`striped`/`bordered`/`color`) (PR #771)
- [x] Hide Fields/Group/Color/Density toolbar buttons conditionally rendered via `showHideFields`/`showGroup`/`showColor`/`showDensity` (Issue #719)
- [x] Export button checks both `exportOptions` and `allowExport` (Issue #719)
- [x] `hasExport` logic fixed — no longer always true when `allowExport` is undefined (Issue #719)
- [x] ViewConfigPanel includes toggles for `showHideFields`/`showGroup`/`showColor`/`showDensity` (Issue #719)
- [x] `showHideFields`/`showGroup`/`showColor`/`showDensity`/`allowExport` propagated through Console `fullSchema` and PluginObjectView `renderListView` (Issue #719)
- [x] Full end-to-end data flow: all ViewConfigPanel props (`inlineEdit`/`wrapHeaders`/`clickIntoRecordDetails`/`addRecordViaForm`/`addDeleteRecordsInline`/`collapseAllByDefault`/`fieldTextColor`/`prefixField`/`showDescription`) propagated through Console `fullSchema` → PluginObjectView `renderListView` → ListView (Issue #719)
- [x] ListView forwards `striped`/`bordered`/`wrapHeaders` to child `viewComponentSchema` (grid gets `wrapHeaders`, all views get `striped`/`bordered`) (Issue #719)
- [x] ViewConfigPanel includes `striped`/`bordered` toggles in Appearance section (Issue #719)
- [x] Type definitions complete: `NamedListView` + `ListViewSchema` + Zod schema include all 22 view-config properties (Issue #719)

**Phase 2 — Kanban Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` kanban branch
- [x] Pass `color`/`striped`/`bordered` in `renderContent` → `renderListView` for kanban
- [x] Ensure `groupBy` config changes reflect immediately (currently ✅ via `renderListView`)
- [x] Add integration test: ViewConfigPanel kanban config change → Kanban renderer receives updated props

**Phase 3 — Calendar Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` calendar branch
- [x] Pass `filter`/`sort`/appearance properties to calendar renderer in real-time
- [x] Verify `startDateField`/`endDateField` config changes trigger re-render via `useMemo` deps
- [x] Add integration test: ViewConfigPanel calendar config change → Calendar renderer receives updated props

**Phase 4 — Timeline/Gantt Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` timeline/gantt branches
- [x] Pass appearance properties (`color`, `striped`, `bordered`) through `renderListView` schema
- [x] Ensure `dateField`/`startDateField`/`endDateField` config changes trigger re-render
- [x] Add integration tests for timeline and gantt config sync

**Phase 5 — Gallery & Map Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` gallery/map branches
- [x] Pass appearance properties through `renderListView` schema for gallery/map
- [x] Ensure gallery `imageField`/`titleField` and map `locationField`/`zoom`/`center` config changes trigger re-render
- [x] Add integration tests for gallery and map config sync

**Phase 6 — Data Flow & Dependency Refactor:**
- [x] Add `showSearch`/`showSort`/`showFilters`/`striped`/`bordered`/`color` to `NamedListView` type in `@object-ui/types`
- [x] Add `showHideFields`/`showGroup`/`showColor`/`showDensity`/`allowExport` to `NamedListView` and `ListViewSchema` types and Zod schema (Issue #719)
- [x] Add `inlineEdit`/`wrapHeaders`/`clickIntoRecordDetails`/`addRecordViaForm`/`addDeleteRecordsInline`/`collapseAllByDefault`/`fieldTextColor`/`prefixField`/`showDescription` to `NamedListView` and `ListViewSchema` types and Zod schema (Issue #719)
- [x] Update Console `renderListView` to pass all config properties in `fullSchema`
- [ ] Audit all `useMemo`/`useEffect` dependency arrays in `plugin-view/ObjectView.tsx` for missing `activeView` sub-properties
- [x] Remove hardcoded `showSearch: false` from `generateViewSchema` — use `activeView.showSearch ?? schema.showSearch` instead

**Phase 7 — End-to-End Integration Tests:**
- [x] Per-view-type test: Grid config sync (showSort, showSearch, showFilters, striped, bordered)
- [x] Per-view-type test: Kanban config sync (groupBy, color, showSearch)
- [x] Per-view-type test: Calendar config sync (startDateField, endDateField, showFilters)
- [x] Per-view-type test: Timeline/Gantt config sync (dateField, appearance)
- [x] Per-view-type test: Gallery config sync (imageField, titleField, appearance)
- [x] Per-view-type test: Map config sync (locationField, zoom, center, appearance)
- [x] Cross-view-type test: Switch view type in ViewConfigPanel → verify config properties transfer correctly

### P1.10 Console — Dashboard Config Panel

> Airtable-style right-side configuration panel for dashboards. Phased rollout from shared infrastructure to full type-safe editing.

**Phase 0 — Component Infrastructure:**
- [x] Extract `ConfigRow` / `SectionHeader` from `ViewConfigPanel` into `@object-ui/components` as reusable primitives
- [x] Implement `useConfigDraft` generic hook for draft state management (dirty tracking, save/discard)
- [x] Define `ConfigPanelSchema` / `ConfigSection` / `ConfigField` types for schema-driven panel generation
- [x] Implement `ConfigFieldRenderer` supporting input/switch/select/checkbox/slider/color/icon-group/field-picker/filter/sort/custom
- [x] Implement `ConfigPanelRenderer` — schema-driven panel with header, breadcrumb, collapsible sections, sticky footer
- [x] Add `configPanel` i18n keys to all 10 locale files

**Phase 1 — Dashboard-Level Config Panel:**
- [x] Develop `DashboardConfigPanel` supporting layout (columns/gap/rowHeight), data (refreshInterval), appearance (title/description/theme)
- [x] Add Storybook stories for `ConfigPanelRenderer` and `DashboardConfigPanel`
- [x] Add Vitest tests (65 tests: useConfigDraft 10, ConfigFieldRenderer 22, ConfigPanelRenderer 21, DashboardConfigPanel 12)

**Phase 2 — Widget-Level Configuration:**
- [x] Support click-to-select widget → sidebar switches to widget property editor (title, type, data binding, layout)
- [x] Implement `WidgetConfigPanel` with schema-driven fields: general (title, description, type), data binding (object, categoryField, valueField, aggregate), layout (width, height), appearance (colorVariant, actionUrl)
- [x] Add Vitest tests (14 tests for WidgetConfigPanel)

**Phase 3 — Sub-Editor Integration:**
- [x] Integrate `FilterBuilder` for dashboard global filters (ConfigFieldRenderer `filter` type now renders inline FilterBuilder)
- [x] Integrate `SortBuilder` for sort configuration (ConfigFieldRenderer `sort` type now renders inline SortBuilder)
- [x] Add `fields` prop to `ConfigField` type for filter/sort field definitions
- [ ] Dropdown filter selector and action button sub-panel visual editing

**Phase 4 — Composition & Storybook:**
- [x] Build `DashboardWithConfig` composite component (dashboard + config sidebar)
- [x] Support widget selection → WidgetConfigPanel switch with back navigation
- [x] Add Storybook stories for `WidgetConfigPanel`, `DashboardWithConfig`, and `DashboardWithConfigClosed`
- [x] Add Vitest tests (9 tests for DashboardWithConfig)

**Phase 5 — Type Definitions & Validation:**
- [x] Add `DashboardConfig` types to `@object-ui/types`
- [x] Add Zod schema validation for `DashboardConfig`

**Phase 6 — Design Mode Preview Click-to-Select:**
- [x] Add `designMode`, `selectedWidgetId`, `onWidgetClick` props to `DashboardRenderer` for preview-area widget selection
- [x] Implement click-to-select with primary ring highlight (light/dark theme compatible, a11y focus-visible ring)
- [x] Click empty space to deselect; Escape key to deselect
- [x] Keyboard navigation: ArrowRight/ArrowDown to next widget, ArrowLeft/ArrowUp to previous, Enter/Space to select, Tab/Shift+Tab for focus
- [x] Add `selectedWidgetId` and `onWidgetSelect` props to `DashboardEditor` for external controlled selection
- [x] Sync selection between `DashboardRenderer` (preview) and `DashboardEditor` (drawer) via shared state in `DashboardView`
- [x] Property changes in editor panel instantly reflected in preview (live preview path verified end-to-end)
- [x] Auto-save property changes to backend via DesignDrawer
- [x] Add Vitest tests (15 DashboardRenderer design mode + 9 DashboardEditor external selection + 8 DashboardView integration = 32 new tests)

**Phase 7 — Non-Modal Drawer & Property Panel UX Fix:**
- [x] `SheetContent` — added `hideOverlay` prop to conditionally skip the full-screen backdrop overlay
- [x] `DesignDrawer` — `modal={false}` + `hideOverlay` so preview widgets are clickable while drawer is open
- [x] `DashboardEditor` — property panel renders above widget grid (stacked `flex-col` layout) for immediate visibility in narrow drawer
- [x] `DashboardEditor` — property panel uses full width (removed fixed `w-72`) for better readability in drawer context
- [x] Preview click → editor property panel linkage now works end-to-end (select, switch, deselect)
- [x] Add 11 new tests (7 DashboardDesignInteraction integration + 4 DashboardEditor.propertyPanelLayout)

**Phase 8 — Inline Config Panel Refactor (ListView Parity):**
- [x] Replace `DesignDrawer` + `DashboardEditor` in `DashboardView` with inline `DashboardConfigPanel` / `WidgetConfigPanel`
- [x] Right-side panel shows `DashboardConfigPanel` when no widget selected (dashboard-level properties: columns, gap, refresh, theme)
- [x] Right-side panel switches to `WidgetConfigPanel` when a widget is selected (title, type, data binding, layout, appearance)
- [x] Config panels use standard `ConfigPanelRenderer` with save/discard/footer (matches ListView/PageDesigner pattern)
- [x] Add-widget toolbar moved to main area header (visible only in edit mode)
- [x] Main area remains WYSIWYG preview via `DashboardRenderer` with `designMode` click-to-select
- [x] Widget config flattening/unflattening (layout.w ↔ layoutW, layout.h ↔ layoutH)
- [x] Auto-save on config save via `useAdapter().update()`
- [x] Live preview updates via `onFieldChange` callback
- [x] Config draft stabilization via `configVersion` counter (matching ViewConfigPanel's `stableActiveView` pattern) — prevents `useConfigDraft` draft reset on live field changes
- [x] Widget delete via `headerExtra` delete button in WidgetConfigPanel header
- [x] `WidgetConfigPanel` — added `headerExtra` prop for custom header actions
- [x] Update 21 integration tests (10 DashboardDesignInteraction + 11 DashboardViewSelection) to verify inline config panel pattern, widget deletion, live preview sync

**Phase 9 — Design Mode Widget Selection Click-Through Fix:**
- [x] Fix: Widget content (charts, tables via `SchemaRenderer`) intercepted click events, preventing selection in edit mode
- [x] Defense layer 1: `pointer-events-none` on `SchemaRenderer` content wrappers disables chart/table hover and tooltip interactivity in design mode
- [x] Defense layer 2: Transparent click-capture overlay (`absolute inset-0 z-10`) renders on top of widget content in design mode — guarantees click reaches widget handler even if SVG children override `pointer-events`
- [x] Self-contained (metric) widgets: both `pointer-events-none` on SchemaRenderer + overlay inside `relative` wrapper
- [x] Card-based (chart/table) widgets: `pointer-events-none` on `CardContent` inner wrapper + overlay inside `relative` Card
- [x] No impact on non-design mode — widgets remain fully interactive when not editing
- [x] Updated SchemaRenderer mock to forward `className` and include interactive child button for more realistic testing
- [x] Add 9 new Vitest tests: pointer-events-none presence/absence, overlay presence/absence, relative positioning, click-to-select on Card-based widgets

### P1.11 Console — Schema-Driven View Config Panel Migration

> Migrated the Console ViewConfigPanel from imperative implementation (~1655 lines) to Schema-Driven architecture using `ConfigPanelRenderer` + `useConfigDraft` + `ConfigPanelSchema`, reducing to ~170 lines declarative wrapper + schema factory.

**Phase 1 — Infrastructure & Utils Extraction:**
- [x] Extract operator mapping (`SPEC_TO_BUILDER_OP`, `BUILDER_TO_SPEC_OP`), `normalizeFieldType`, `parseSpecFilter`, `toSpecFilter` to shared `view-config-utils.ts`
- [x] Extract `parseCommaSeparated`, `parseNumberList`, `VIEW_TYPE_LABELS`, `ROW_HEIGHT_OPTIONS` to shared utils
- [x] Add `deriveFieldOptions`, `toFilterGroup`, `toSortItems` bridge helpers
- [x] Enhance `ConfigPanelRenderer` with accessibility props (`panelRef`, `role`, `ariaLabel`, `tabIndex`)
- [x] Enhance `ConfigPanelRenderer` with test ID override props (`testId`, `closeTitle`, `footerTestId`, `saveTestId`, `discardTestId`)

**Phase 2 — Schema Factory (All Sections):**
- [x] Page Config section: label, description, viewType, toolbar toggles (7 switches), navigation mode/width/openNewTab, selection, addRecord sub-editor, export + sub-config, showRecordCount, allowPrinting
- [x] Data section: source, sortBy (expandable), groupBy (grid/gallery), columns selector (expandable w/ reorder), filterBy (expandable), pagination, searchable/filterable/hidden fields (expandable), quickFilters (expandable), virtualScroll (grid only), type-specific options (kanban/calendar/map/gallery/timeline/gantt)
- [x] Appearance section: color (grid/calendar/timeline/gantt), rowHeight (icon group, grid only), wrapHeaders (grid only), showDescription, striped/bordered (grid only), resizable (grid only), conditionalFormatting (expandable, grid/kanban), emptyState (title/message/icon)
- [x] User Actions section: inlineEdit (grid only), addDeleteRecordsInline (grid only), rowActions/bulkActions (expandable, grid/kanban)
- [x] Sharing section: sharingEnabled, sharingVisibility (visibleWhen: sharing.enabled)
- [x] Accessibility section: ariaLabel, ariaDescribedBy, ariaLive
- [x] `ExpandableWidget` component for hook-safe expandable sub-sections within custom render functions

**Phase 3 — ViewConfigPanel Wrapper:**
- [x] Rewrite ViewConfigPanel as thin wrapper (~170 lines) using `useConfigDraft` + `buildViewConfigSchema` + `ConfigPanelRenderer`
- [x] Stabilize source reference with `useMemo` keyed to `activeView.id` (prevents draft reset on parent re-renders)
- [x] Create/edit mode support preserved (onCreate/onSave, discard behavior)
- [x] All spec format bridging preserved (filter/sort conversion)

**Phase 4 — Testing & Validation:**
- [x] All 122 existing ViewConfigPanel tests pass (test mock updated for ConfigPanelRenderer + useConfigDraft)
- [x] All 23 ObjectView integration tests pass (test ID and title props forwarded)
- [x] 53 new schema-driven tests (utils + schema factory coverage)
- [x] 14 new ObjectGrid rowHeight tests (all 5 enum values: initialization, cycle, label, toggle visibility)
- [x] Full affected test suite: 2457+ tests across 81+ files, all pass

**Phase 5 — Spec Alignment Completion (Issue #745):**
- [x] ObjectGrid rowHeight: full 5-enum rendering (cellClassName, cycleRowHeight, icon map) — was hardcoded to 3
- [x] 18 new ViewConfigPanel interaction tests: collapseAllByDefault, showDescription, clickIntoRecordDetails, addDeleteRecordsInline toggles; sharing visibility conditional hide; navigation width/openNewTab conditional rendering; all 5 rowHeight button clicks; boundary tests (empty actions, long labels, special chars); pageSizeOptions input; densityMode/ARIA live enums; addRecord conditional sub-editor; sharing visibility select
- [x] 8 new schema-driven spec tests: accessibility field ordering, emptyState compound field, switch field defaults, comprehensive visibleWhen predicates (sharing, navigation width, navigation openNewTab)
- [x] All spec fields verified: Appearance/UserActions/Sharing/Accessibility sections 100% covered with UI controls, defaults, ordering, and conditional visibility
- [x] Add `description` field to `NamedListView` protocol interface (spec alignment)
- [x] Add `disabledWhen` predicate to `ConfigField` type — grid-only fields (striped/bordered/wrapHeaders/resizable) disabled for non-grid views
- [x] Add `expandedSections` prop to `ConfigPanelRenderer` for external section collapse control (auto-focus/highlight)
- [x] Add `helpText` to navigation-dependent fields (width/openNewTab) with i18n hints (all 11 locales)
- [x] 24 new tests: expandedSections override (3), disabledWhen evaluation (2), grid-only disabledWhen predicates (16), helpText validation (2), description spec alignment (1)

**Phase 6 — Config Panel Cleanup (Invalid Items Fix):**
- [x] Remove `densityMode` field from appearance section (redundant with `rowHeight` which provides finer 5-value granularity)
- [x] Remove `prefixField` from data section (not consumed by any runtime renderer)
- [x] Remove `collapseAllByDefault` from appearance section (not consumed by any runtime renderer)
- [x] Remove `fieldTextColor` from appearance section (not consumed by any runtime renderer)
- [x] Remove `clickIntoRecordDetails` from userActions section (controlled implicitly via navigation mode, not directly consumed)
- [x] Add view-type-aware `visibleWhen` to toolbar toggles: `showGroup` (grid/kanban/gallery), `showColor` (grid/calendar/timeline/gantt), `showDensity` (grid only), `showRecordCount` (grid only), `allowPrinting` (grid only)
- [x] Add view-type-aware `visibleWhen` to data fields: `_groupBy` (grid/gallery — kanban uses dedicated type-specific option), `virtualScroll` (grid only)
- [x] Add view-type-aware `visibleWhen` to appearance fields: `striped`/`bordered`/`wrapHeaders`/`resizable`/`rowHeight` (grid only, changed from disabledWhen to visibleWhen), `color` (grid/calendar/timeline/gantt), `conditionalFormatting` (grid/kanban)
- [x] Add view-type-aware `visibleWhen` to userActions fields: `inlineEdit`/`addDeleteRecordsInline` (grid only), `rowActions`/`bulkActions` (grid/kanban)
- [x] Correct `searchableFields`/`filterableFields`/`quickFilters`/`showDescription` to universal (all view types) — data fetch/toolbar features not view-specific
- [x] Extend `buildSwitchField` and `buildFieldMultiSelect` helpers to accept `visibleWhen` parameter
- [x] Define semantic predicates: `supportsGrouping`, `supportsColorField`, `supportsConditionalFormatting`, `supportsRowActions`, `supportsGenericGroupBy`
- [x] 103 schema tests pass (updated field key lists, visibleWhen predicates for all view types, removed field verification)
- [x] 136 ViewConfigPanel interaction tests pass (removed tests for deleted fields)
- [x] 10 config-sync integration tests pass

**Code Reduction:** ~1655 lines imperative → ~170 lines declarative wrapper + ~1100 lines schema factory + ~180 lines shared utils = **>50% net reduction in component code** with significantly improved maintainability

### P1.9 Console — Content Area Layout & Responsiveness

- [x] Add `min-w-0` / `overflow-hidden` to flex layout chain (SidebarInset → AppShell → ObjectView → PluginObjectView) to prevent content overflow
- [x] Fix Gantt task list width — responsive sizing (120px mobile, 200px tablet, 300px desktop) instead of hardcoded 300px
- [x] Fix Kanban board overflow containment (`min-w-0` on swimlane and flat containers)
- [x] Fix Calendar header responsive wrapping and date label sizing
- [x] Fix Map container overflow containment via `cn()` merge
- [x] Fix Timeline container `min-w-0` to prevent overflow
- [x] Fix ListView container `min-w-0 overflow-hidden` to prevent overflow
- [ ] Mobile/tablet end-to-end testing for all view types
- [ ] Dynamic width calculation for Gantt task list and Kanban columns based on container width

### P1.11 App Creation & Editing Flow (Airtable Interface Designer UX)

> Full app creation & editing experience aligned with Airtable Interface Designer UX.
> Components live in `@object-ui/plugin-designer`, types in `@object-ui/types`.

**Types & Interfaces:**
- [x] `AppWizardDraft` / `AppWizardStep` / `BrandingConfig` / `ObjectSelection` / `EditorMode` types
- [x] `isValidAppName()` snake_case validator function
- [x] `wizardDraftToAppSchema()` draft-to-schema conversion function

**App Creation Wizard (4-step):**
- [x] Step 1: Basic Info — name (snake_case validated), title, description, icon, template, layout selector
- [x] Step 2: Object Selection — card grid with search, select all/none, toggle selection
- [x] Step 3: Navigation Builder — auto-generates NavigationItem[] from selected objects, add group/URL/separator, reorder up/down, remove
- [x] Step 4: Branding — logo URL, primary color, favicon, live preview card
- [x] Step indicator with connected progress dots
- [x] Step validation (step 1 requires valid snake_case name + title)
- [x] onComplete callback returns full AppWizardDraft

**Navigation Designer:**
- [x] Recursive NavigationItem tree renderer (supports infinite nesting)
- [x] Quick add buttons for all 7 nav item types (object, dashboard, page, report, group, URL, separator)
- [x] Inline label editing (double-click to edit, Enter/Escape to commit/discard)
- [x] Add child to groups (nested navigation)
- [x] Reorder items (up/down buttons)
- [x] Deep tree operations (remove/reorder works at any depth)
- [x] Live preview sidebar showing navigation as rendered
- [x] Type badges with color coding
- [x] Icon editing (inline icon name input with pencil button, Enter/Escape commit/discard)
- [x] Visibility toggle (eye/eye-off icon per node, hidden badge display)
- [x] Export/Import navigation JSON Schema (toolbar buttons with file I/O, custom callbacks)
- [x] Mobile responsive layout (flex-col on mobile, sm:flex-row on desktop)

**Page Canvas Editor:**
- [x] Component palette (Grid, Kanban, Calendar, Gallery, Dashboard, Form, Layout Grid)
- [x] Component list with drag handles, selection, reorder
- [x] Property panel for selected component (label, type, ID)
- [x] Add/remove/reorder components
- [x] Syncs PageSchema children on every change
- [x] Undo/Redo integration via `useUndoRedo` hook (Ctrl+Z / Ctrl+Y keyboard shortcuts)
- [x] JSON Schema export/import (Download/Upload toolbar buttons with `onExport`/`onImport` callbacks)
- [x] Preview mode toggle (Eye icon, renders PagePreview panel)
- [x] Page/Dashboard mode tab switching (role="tablist" with aria-selected)
- [x] i18n integration via `useDesignerTranslation` (all labels use translation keys)
- [x] Keyboard shortcuts (Delete/Backspace to remove selected component)
- [x] Mobile responsive layout (flex-col on mobile, sm:flex-row on desktop)

**Dashboard Editor:**
- [x] 6 widget types (KPI Metric, Bar Chart, Line Chart, Pie Chart, Table, Grid)
- [x] Widget card grid with selection, drag handles, reorder
- [x] Widget property panel (title, type, data source, value field, aggregate, color variant)
- [x] Add/remove/reorder widgets
- [x] Grid layout based on DashboardSchema columns
- [x] Undo/Redo integration via `useUndoRedo` hook (Ctrl+Z / Ctrl+Y keyboard shortcuts)
- [x] JSON Schema export/import (Download/Upload toolbar buttons with `onExport`/`onImport` callbacks)
- [x] Preview mode toggle (Eye icon, renders DashboardPreview panel)
- [x] Widget layout size editing (width/height inputs in property panel)
- [x] i18n integration via `useDesignerTranslation` (all labels use translation keys)
- [x] Keyboard shortcuts (Delete/Backspace to remove selected widget)
- [x] Mobile responsive layout (flex-col on mobile, sm:flex-row on desktop)

**Object View Configurator:**
- [x] 7 view type switcher (Grid, Kanban, Calendar, Gallery, Timeline, Map, Gantt)
- [x] Column visibility toggle with visible count
- [x] Column reorder (up/down)
- [x] Toolbar toggles (showSearch, showFilters, showSort)
- [x] Appearance section (row height, striped, bordered)
- [x] Collapsible sections

**Editor Mode Toggle:**
- [x] Three-way toggle (Edit / Preview / Code)
- [x] Radio group accessibility (role="radiogroup", aria-checked)
- [x] Disabled state support

**i18n:**
- [x] `appDesigner` section with 133 keys added to all 10 locales (en, zh, ja, de, fr, es, ar, ru, pt, ko)
- [x] `useDesignerTranslation` safe wrapper hook with English fallback (no I18nProvider required)
- [x] AppCreationWizard fully i18n-integrated (all labels, buttons, step names, validation messages)
- [x] NavigationDesigner fully i18n-integrated (type badges, quick-add labels, aria-labels, preview, icon editing, visibility, export/import)
- [x] DashboardEditor fully i18n-integrated (toolbar labels, preview text)
- [x] PageCanvasEditor fully i18n-integrated (toolbar labels, mode tabs, preview text)
- [x] BrandingEditor fully i18n-integrated (14 new keys: editor title, export/import, preview, palette, font, light/dark, mobile preview, sample text)

**UX Enhancements:**
- [x] Cancel confirmation dialog with unsaved-changes detection
- [x] `onSaveDraft` callback for partial progress save
- [x] `useConfirmDialog` hook integration for cancel workflow

**Testing:**
- [x] 11 type tests (isValidAppName, wizardDraftToAppSchema, type shapes)
- [x] 41 AppCreationWizard tests (rendering, steps 1-4, navigation, callbacks, cancel confirm, save draft, i18n, read-only)
- [x] 33 NavigationDesigner tests (rendering, add, remove, groups, badges, i18n, read-only, icon editing, visibility toggle, export/import, responsive)
- [x] 7 EditorModeToggle tests (render, active mode, onChange, accessibility, disabled)
- [x] 22 DashboardEditor tests (rendering, add/remove widgets, property panel, read-only, undo/redo, export/import, preview mode, widget layout)
- [x] 23 PageCanvasEditor tests (rendering, add/remove components, property panel, read-only, mode tabs, undo/redo, export/import, preview mode)
- [x] 12 ObjectViewConfigurator tests (rendering, view type switch, column visibility, toggles, read-only)
- [x] 29 BrandingEditor tests (rendering, editing, light/dark preview, read-only, undo/redo, export/import, keyboard shortcuts, preview content)
- [x] **Total: 238 tests across 10 files, all passing**

**ComponentRegistry:**
- [x] Registered: `app-creation-wizard`, `navigation-designer`, `dashboard-editor`, `page-canvas-editor`, `object-view-configurator`, `branding-editor`

**Branding Editor:**
- [x] Logo URL input with live preview (light/dark logo placeholders)
- [x] Visual color picker with native `<input type="color">` and text hex input
- [x] 16-color preset palette swatches (Blue, Indigo, Violet, Purple, Pink, Red, Orange, Amber, Yellow, Green, Teal, Cyan, Sky, Slate, Dark, Navy)
- [x] Favicon URL input with preview
- [x] Font family selector (9 common web fonts + system default)
- [x] Light/Dark mode preview toggle
- [x] Real-time preview panel (desktop + mobile)
- [x] Undo/Redo via `useUndoRedo` hook (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y keyboard shortcuts)
- [x] JSON Schema export/import (Download/Upload toolbar buttons with `onExport`/`onImport` callbacks)
- [x] Read-only mode support (disables all inputs, palette clicks, undo/redo, import)
- [x] Mobile responsive layout (flex-col on mobile, sm:flex-row on desktop)
- [x] i18n integration via `useDesignerTranslation` (14 new translation keys in all 10 locales)
- [x] Outputs to `BrandingConfig` type (AppSchema.branding protocol)
- [x] 29 unit tests (rendering, editing, light/dark preview, read-only, undo/redo, export/import, keyboard shortcuts, preview content)

**Console Integration:**
- [x] `CreateAppPage` — renders `AppCreationWizard` with `useMetadata()` objects, `onComplete`/`onCancel`/`onSaveDraft` callbacks
- [x] `EditAppPage` — reuses wizard with `initialDraft` from existing app config
- [x] Routes: `/apps/:appName/create-app`, `/apps/:appName/edit-app/:editAppName`
- [x] AppSidebar "Add App" button → navigates to `/create-app`
- [x] AppSidebar "Edit App" button → navigates to `/edit-app/:appName`
- [x] CommandPalette "Create New App" command (⌘+K → Actions group)
- [x] Empty state CTA "Create Your First App" when no apps configured
- [x] `wizardDraftToAppSchema()` conversion on completion — includes `icon`, `label`, `branding` fields
- [x] `EditAppPage` merges wizard output with original app config to preserve fields not in wizard (e.g. `active`)
- [x] `client.meta.saveItem('app', name, schema)` — persists app metadata to backend on create/edit
- [x] MSW PUT handler for `/meta/:type/:name` — dev/mock mode metadata persistence
- [x] Draft persistence to localStorage with auto-clear on success
- [x] `createApp` i18n key added to all 10 locales
- [x] 13 console integration tests (routes, wizard callbacks, draft persistence, saveItem, CommandPalette)
- [x] `PageDesignPage` — integrates `PageCanvasEditor` at `/design/page/:pageName` route with auto-save, JSON export/import
- [x] `DashboardDesignPage` — integrates `DashboardEditor` at `/design/dashboard/:dashboardName` route with auto-save, JSON export/import
- [x] "Edit" button on `PageView` and `DashboardView` — opens right-side `DesignDrawer` with real-time preview (no page navigation)
- [x] `DesignDrawer` component — reusable right-side Sheet panel hosting editors with auto-save, Ctrl+S shortcut, and live schema sync
- [x] Ctrl+S/Cmd+S keyboard shortcut to explicitly save in both design pages (with toast confirmation)
- [x] Storybook stories for `PageCanvasEditor` and `DashboardEditor` (Designers/PageCanvasEditor, Designers/DashboardEditor)
- [x] 12 console design page tests (PageDesignPage + DashboardDesignPage: routes, 404 handling, editor rendering, onChange, Ctrl+S save)
- [x] 7 DesignDrawer tests (drawer open/close, editor rendering, real-time preview sync, auto-save, Ctrl+S, no navigation)

### P1.12 System Settings & App Management Center

> Unified system settings hub, app management page, and permission management page.

**System Hub Page (`/system/`):**
- [x] Card-based overview linking to all system administration sections
- [x] Live statistics for each section (users, orgs, roles, permissions, audit logs, apps)
- [x] Navigation to Apps, Users, Organizations, Roles, Permissions, Audit Log, Profile

**App Management Page (`/system/apps`):**
- [x] Full app list with search/filter
- [x] Enable/disable toggle per app
- [x] Set default app
- [x] Delete app with confirmation
- [x] Bulk select with enable/disable operations
- [x] Navigate to Create App / Edit App pages
- [x] Navigate to app home

**Permission Management Page (`/system/permissions`):**
- [x] CRUD grid for `sys_permission` object
- [x] Search/filter permissions
- [x] Admin-only create/delete controls

**Sidebar & Navigation Updates:**
- [x] Settings button → `/system/` hub (was `/system/profile`)
- [x] App switcher "Manage All Apps" link → `/system/apps`

**Routes:**
- [x] `/system/` → SystemHubPage
- [x] `/system/apps` → AppManagementPage
- [x] `/system/permissions` → PermissionManagementPage

**Tests:**
- [x] 11 new tests (SystemHubPage, AppManagementPage, PermissionManagementPage)
- [x] Total: 20 system page tests passing

---

## 🧩 P2 — Polish & Advanced Features

### P2.0 Flow Designer ✅

> **Status:** Complete — `FlowDesigner` component shipped in `@object-ui/plugin-workflow`.

The `FlowDesigner` is a canvas-based flow editor that bridges the gap between the approval-focused `WorkflowDesigner` and the BPMN-heavyweight `ProcessDesigner`. It targets automation/integration flows with spec v3.0.9 types.

**Core Canvas:**
- [x] Drag-to-reposition nodes on SVG canvas
- [x] Undo/redo with keyboard shortcuts (`Ctrl+Z` / `Ctrl+Y`)
- [x] Ctrl+S save shortcut with `onSave` callback
- [x] Zoom in/out/reset controls
- [x] Edge creation by clicking source → target connection ports
- [x] Node deletion via delete button or `Delete` key

**Node Types (spec v3.0.9):**
- [x] Standard nodes: `start`, `end`, `task`, `user_task`, `service_task`, `script_task`, `approval`, `condition`
- [x] Gateway nodes: `parallel_gateway`, `join_gateway`
- [x] Event nodes: `boundary_event`, `delay`, `notification`, `webhook`

**Edges (spec v3.0.9):**
- [x] Edge types: `default`, `conditional`, `timeout`
- [x] Conditional edges with `condition` expression field
- [x] `isDefault` flag for default/fallthrough edge marking
- [x] Visual differentiation: dashed lines for conditional, dotted for default

**Property Panel:**
- [x] Node property editor: label, type, description
- [x] Node executor configuration: `FlowNodeExecutorDescriptor` (type, `inputSchema`, `outputSchema`, `timeoutMs`, retry policy)
- [x] Wait event config for delay nodes: `FlowWaitEventType` (condition/manual/webhook/timer/signal)
- [x] Boundary event config: `FlowBoundaryConfig` (`attachedToNodeId`, `eventType`, `cancelActivity`, `timer`, `errorCode`)
- [x] Edge property editor: label, type, condition expression, `isDefault` toggle

**Spec v3.0.9 Protocol Features:**
- [x] `FlowVersionEntry[]` version history panel with current/previous entries
- [x] `FlowConcurrencyPolicy` badge display (allow/forbid/replace/queue)
- [x] `FlowExecutionStep[]` execution monitoring overlay with per-node status icons
- [x] `FlowBpmnInteropResult` BPMN XML export with warning/error reporting

**ComponentRegistry:**
- [x] Registered as `'flow-designer'` with all inputs documented

### P2.1 Designer — Remaining Interaction (Post-v1.0)

- [ ] PageDesigner: Component drag-to-reorder and drag-to-position
- [ ] ProcessDesigner: Node drag-to-move
- [x] ProcessDesigner/FlowDesigner: Support v3.0.9 node types (`parallel_gateway`, `join_gateway`, `boundary_event`) — implemented in FlowDesigner
- [x] ProcessDesigner/FlowDesigner: Support v3.0.9 conditional edges and default edge marking — implemented in FlowDesigner
- [x] ReportView: Refactored to left-right split layout (preview + DesignDrawer) — consistent with DashboardView/ListView
- [x] ReportConfigPanel: Schema-driven config via ConfigPanelRenderer + useConfigDraft (replaces full-page ReportBuilder in edit mode)
- [ ] ReportDesigner: Element drag-to-reposition within sections
- [x] FlowDesigner: Edge creation UI (click source port → click target port)
- [x] FlowDesigner: Property editing for node labels/types + executor config + boundary config
- [ ] Confirmation dialogs for ProcessDesigner destructive actions

### P2.2 Designer — Advanced Features

- [ ] Full property editors for all designers (PageDesigner, ProcessDesigner, ReportDesigner)
- [ ] i18n integration: all hardcoded strings through `resolveI18nLabel`
- [ ] Canvas pan/zoom with minimap
- [ ] Auto-layout algorithms (force-directed for DataModel, Dagre for Process)
- [ ] Copy/paste support (`Ctrl+C`/`Ctrl+V`) across all designers
- [ ] Multi-select (`Ctrl+Click`, `Shift+Click`) and bulk operations
- [ ] Responsive collapsible panels

### P2.3 Designer — Collaboration Integration

- [ ] Wire `CollaborationProvider` into each designer's state management
- [ ] Live cursor positions (PresenceCursors component)
- [ ] Operation-based undo/redo sync
- [ ] Conflict resolution UI (merge dialog)
- [ ] Version history browser with restore

### P2.4 Spec Compliance Gaps (Low Priority)

- [ ] `@object-ui/core`: DataScope module — row-level permission enforcement
- [ ] `@object-ui/core`: Custom validator registration API
- [ ] `@object-ui/core`: STDEV, VARIANCE, PERCENTILE, MEDIAN formula functions
- [ ] `@object-ui/react`: useTheme hook for component-level theme access
- [ ] `@object-ui/react`: Re-export usePermissions for unified hook API
- [ ] `@object-ui/components`: ErrorBoundary wrapper per component
- [ ] `@object-ui/fields`: Inline validation message rendering
- [ ] `@object-ui/plugin-charts`: Drill-down click handler for chart segments
- [x] `@object-ui/plugin-charts`: Fix `object-chart` crash when data is non-array — added `Array.isArray()` guards in ObjectChart, ChartRenderer, and AdvancedChartImpl to prevent Recharts `r.slice is not a function` error
- [x] `@object-ui/plugin-workflow`: **FlowDesigner** — canvas-based flow editor (`flow-designer` component) with drag-to-reposition nodes, edge creation UI, undo/redo, Ctrl+S save, property panel, and BPMN export
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 BPMN interop types — `FlowBpmnInteropResult` with `bpmnXml` export, `nodeCount`, `edgeCount`, `warnings`
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 node executor descriptors — `FlowNodeExecutorDescriptor` with `inputSchema`, `outputSchema`, wait event config, retry policy
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 `inputSchema`/`outputSchema` on flow nodes via `FlowNodeExecutorDescriptor`
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 `boundaryConfig` for boundary event nodes — `FlowBoundaryConfig` with `attachedToNodeId`, `eventType`, `cancelActivity`, `timer`, `errorCode`
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 node types — `parallel_gateway`, `join_gateway`, `boundary_event` in `FlowNodeType`
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 conditional edges — `FlowEdge.type = 'conditional'` + `isDefault` flag
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 `FlowVersionHistory` — `FlowVersionEntry[]` with version number, author, changeNote, isCurrent
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 `ConcurrencyPolicy` — `FlowConcurrencyPolicy` (allow/forbid/replace/queue)
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 `WaitEventType` — `FlowWaitEventType` (condition/manual/webhook/timer/signal)
- [x] `@object-ui/plugin-workflow`: Support v3.0.9 execution tracking — `FlowExecutionStep` with status overlay on nodes
- [ ] `@object-ui/plugin-ai`: Configurable AI endpoint adapter (OpenAI, Anthropic)
- [ ] Navigation `width` property: apply to drawer/modal overlays across all plugins
- [ ] Navigation `view` property: specify target form/view on record click across all plugins
- [ ] Support App `engine` field (`{ objectstack: string }`) for version pinning (v3.0.9)
- [ ] Integrate v3.0.9 package upgrade protocol (`PackageArtifact`, `ArtifactChecksum`, `UpgradeContext`)
- [x] `@object-ui/types`: Align `ViewType` with spec ListView type enum — add `'gallery'` and `'gantt'` (was missing from `views.ts` and `views.zod.ts`)
- [x] `@object-ui/types`: Sync `DetailViewFieldSchema` Zod validator with TS interface — add data-oriented field types (`number`, `currency`, `percent`, `boolean`, `select`, `lookup`, `master_detail`, `email`, `url`, `phone`, `user`) and missing properties (`options`, `reference_to`, `reference_field`, `currency`)
- [x] `@object-ui/types`: Add `showBorder` and `headerColor` to `DetailViewSectionSchema` Zod validator (already in TS interface)
- [x] `@object-ui/plugin-view`: Add `gallery` and `gantt` to ViewSwitcher default labels and icons
- [x] `@object-ui/plugin-list`: Fix `list-view` and `list` registration `viewType` enum — remove invalid `'list'`/`'chart'`, add `'gallery'`/`'timeline'`/`'gantt'`/`'map'` to match spec
- [x] `@object-ui/plugin-detail`: Add missing `detail-view` registration inputs (`layout`, `columns`, `loading`, `backUrl`, `editUrl`, `deleteConfirmation`, `header`, `footer`)
- [x] `@object-ui/plugin-detail`: Add `showBorder` and `headerColor` inputs to `detail-section` registration

### P2.6 ListView Spec Protocol Gaps (Remaining) ✅

> All items from the ListView Spec Protocol analysis have been implemented.

**P0 — Core Protocol:**
- [x] `data` (ViewDataSchema): ListView consumes `schema.data` — supports `provider: value` (inline items), `provider: object` (fetch from objectName), and plain array shorthand. Falls back to `dataSource.find()` when not set.
- [x] `grouping` rendering: Group button enabled with GroupBy field picker popover. Grouping config wired to ObjectGrid child view, which renders collapsible grouped sections via `useGroupedData` hook.
- [x] `rowColor` rendering: Color button enabled with color-field picker popover. Row color config wired to ObjectGrid child view, which applies row background colors via `useRowColor` hook.

**P1 — Structural Alignment:**
- [x] `quickFilters` structure reconciliation: Auto-normalizes spec `{ field, operator, value }` format into ObjectUI `{ id, label, filters[] }` format. Both formats supported simultaneously. Dual-format type union (`QuickFilterItem = ObjectUIQuickFilterItem | SpecQuickFilterItem`) exported from `@object-ui/types`. Standalone `normalizeQuickFilter()` / `normalizeQuickFilters()` adapter functions in `@object-ui/core`. Bridge (`list-view.ts`) normalizes at spec→SchemaNode transform time. Spec shorthand operators (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) mapped to ObjectStack AST operators. Mixed-format arrays handled transparently.
- [x] `conditionalFormatting` expression reconciliation: Supports spec `{ condition, style }` format alongside ObjectUI field/operator/value rules. Dual-format type union (`ConditionalFormattingRule = ObjectUIConditionalFormattingRule | SpecConditionalFormattingRule`) exported from `@object-ui/types`. Zod validator updated with `z.union()` for both formats. `evaluatePlainCondition()` convenience function in `@object-ui/core` for safe plain/template expression evaluation with record context. Plain expressions (e.g., `status == 'overdue'`) evaluated directly without `${}` wrapper; record fields spread into evaluator context for direct field references alongside `data.` namespace. Mixed-format arrays handled transparently.
- [x] `exportOptions` schema reconciliation: Accepts both spec `string[]` format (e.g., `['csv', 'xlsx']`) and ObjectUI object format `{ formats, maxRecords, includeHeaders, fileNamePrefix }`.
- [x] Column `pinned`: `pinned` property added to ListViewSchema column type. Bridge passes through to ObjectGrid which supports `frozenColumns`. ObjectGrid reorders columns (left-pinned first, right-pinned last with sticky CSS). Zod schema updated with `pinned` field. `useColumnSummary` hook created.
- [x] Column `summary`: `summary` property added to ListViewSchema column type. Bridge passes through for aggregation rendering. ObjectGrid renders summary footer with count/sum/avg/min/max aggregations via `useColumnSummary` hook. Zod schema updated with `summary` field.
- [x] Column `link`: ObjectGrid renders click-to-navigate buttons on link-type columns with `navigation.handleClick`. Primary field auto-linked.
- [x] Column `action`: ObjectGrid renders action dispatch buttons via `executeAction` on action-type columns.
- [x] `tabs` (ViewTabSchema): TabBar component renders view tabs above the ListView toolbar. Supports icon (Lucide), pinned (always visible), isDefault (auto-selected), visible filtering, order sorting, and active tab state. Tab switch applies filter config. Extracted as reusable `TabBar` component in `packages/plugin-list/src/components/TabBar.tsx`. i18n keys added for all 10 locales.

**P2 — Advanced Features:**
- [x] `rowActions`: Row-level dropdown action menu per row in ObjectGrid. `schema.rowActions` string array items rendered as dropdown menu items, dispatched via `executeAction`.
- [x] `bulkActions`: Bulk action bar rendered in ListView when rows are selected and `schema.bulkActions` is configured. Fires `onBulkAction` callback with action name and selected rows.
- [x] `sharing` schema reconciliation: Supports both ObjectUI `{ visibility, enabled }` and spec `{ type: personal/collaborative, lockedBy }` models. Share button renders when either `enabled: true` or `type` is set. Zod validator updated with `type` and `lockedBy` fields. Bridge normalizes spec format: `type: personal` → `visibility: private`, `type: collaborative` → `visibility: team`, auto-sets `enabled: true`.
- [x] `exportOptions` schema reconciliation: Zod validator updated to accept both spec `string[]` format and ObjectUI object format via `z.union()`. ListView normalizes string[] to `{ formats }` at render time.
- [x] `pagination.pageSizeOptions` backend integration: Page size selector is now a controlled component that dynamically updates `effectivePageSize`, triggering data re-fetch. `onPageSizeChange` callback fires on selection. Full test coverage for selector rendering, option enumeration, and data reload.

### P2.7 Platform UI Consistency & Interaction Optimization ✅

> All items from the UI consistency optimization (Issue #749) have been implemented.

**Global Theme & Design Tokens:**
- [x] Hardcoded gray colors in `GridField.tsx`, `ReportRenderer.tsx`, and `ObjectGrid.tsx` replaced with theme tokens (`text-muted-foreground`, `bg-muted`, `border-border`, `border-foreground`)
- [x] Global font-family (`Inter`, ui-sans-serif, system-ui) injected in `index.css` `:root`
- [x] `--config-panel-width: 280px` CSS custom property added for unified config panel sizing
- [x] Border radius standardized to `rounded-lg` across report/grid components
- [x] `transition-colors duration-150` added to all interactive elements (toolbar buttons, tab bar, sidebar menu buttons)
- [x] `LayoutRenderer.tsx` outer shell `bg-slate-50/50 dark:bg-zinc-950` replaced with `bg-background` theme token

**Sidebar Navigation:**
- [x] `SidebarMenuButton` active state enhanced with 3px left indicator bar via `before:` pseudo-element
- [x] `SidebarMenuButton` transition expanded to include `color, background-color` with `duration-150`
- [x] `SidebarGroupLabel` visual separator added (`border-t border-border/30 pt-3 mt-2`)
- [x] Collapsed-mode tooltip support in `SidebarNav` via `tooltip={item.title}` prop
- [ ] `LayoutRenderer.tsx` hand-written sidebar → `SidebarNav` unification (deferred: requires extending SidebarNav to support nested menus, logo, version footer)

**ListView Toolbar:**
- [x] Search changed from expandable button to always-visible inline `<Input>` (`w-48`)
- [x] Activated state (`bg-primary/10 border border-primary/20`) added to Filter/Sort/Group/Color buttons when active
- [x] Toolbar overflow improved with `overflow-x-auto` for responsive behavior
- [x] `transition-colors duration-150` added to all toolbar buttons

**ObjectGrid Cell Renderers:**
- [x] `formatRelativeDate()` function added for relative time display ("Today", "2 days ago", "Yesterday")
- [x] DataTable/VirtualGrid header styling unified: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30`
- [x] Remaining hardcoded gray colors in ObjectGrid loading spinner and status badge fallback replaced with theme tokens
- [x] Select/status type Badge rendering — `getCellRenderer()` returns `<Badge>` with color mapping from `field.options`; auto-generated options from unique data values when type is inferred; priority semantic colors (Critical→red, High→orange, Medium→yellow, Low→gray); muted default style for unconfigured colors
- [x] Date type human-readable formatting — `DateCellRenderer` defaults to relative format ("Today", "Yesterday", "3 days ago"); overdue dates styled with red text; ISO timestamp shown as hover tooltip; `formatRelativeDate()` threshold tightened to 7 days
- [x] Boolean type visual rendering — `BooleanCellRenderer` renders `<Checkbox disabled>` for true/false; null/undefined values display as `—`

**ConfigPanelRenderer:**
- [x] `<Separator>` added between sections for visual clarity
- [x] Panel width uses `--config-panel-width` CSS custom property

**View Tab Bar:**
- [x] Tab spacing tightened (`gap-0.5`, `px-3 py-1.5`)
- [x] Active tab indicator changed to bottom border (`border-b-2 border-primary font-medium text-foreground`)
- [x] `transition-colors duration-150` added to tab buttons

### P2.5 PWA & Offline (Real Sync)

- [ ] Background sync queue → real server sync (replace simulation)
- [ ] Conflict resolution on reconnection wired into Console flow
- [ ] Optimistic updates with TransactionManager state application

---

## 🔮 P3 — Future Vision (Deferred)

### CRM Example Metadata Enhancement ✅

> Comprehensive metadata expansion for the CRM reference implementation.

- [x] **P0: Reports** — Sales Report and Pipeline Report with full ReportSchema (fields, groupBy, sections, schedule, export)
- [x] **P0: Report Navigation** — Native `type: 'report'` navigation items (no shared config hack)
- [x] **P1: Seed Data — Users** — 7 users covering admin, manager, user, viewer roles + inactive user
- [x] **P1: Seed Data — Orders** — 7 orders covering all statuses (draft, pending, paid, shipped, delivered, cancelled)
- [x] **P1: Seed Data — Products** — 2 inactive products (`is_active: false`) for filter testing
- [x] **P1: Order ↔ Product Junction** — `order_items` object with line items (quantity, price, discount, item_type) + 12 seed records
- [x] **P1: Opportunity ↔ Contact Junction** — `opportunity_contacts` object with role-based relationships + 7 seed records
- [x] **P1: Contact ↔ Event Attendees** — `participants` field populated on all event seed data
- [x] **P2: Dashboard Dynamic Data** — "Revenue by Account" widget using `provider: 'object'` aggregation. DashboardRenderer now delegates `provider: 'object'` widgets to ObjectChart (`type: 'object-chart'`) for async data loading + client-side aggregation (sum/count/avg/min/max)
- [x] **P2: Fix Revenue by Account Chart** — Fixed 3 bugs preventing "Revenue by Account" chart from displaying data: (1) ObjectChart `extractRecords()` now handles `results.data` and `results.value` response formats in addition to `results.records`, (2) DashboardRenderer auto-adapts series `dataKey` from `aggregate.field` when aggregate config is present, (3) CRM dashboard `yField` aligned to aggregate field `amount` (was `total`). Added 10 new tests.
- [x] **P2: App Branding** — `logo`, `favicon`, `backgroundColor` fields on CRM app
- [x] **P3: Pages** — Settings page (utility) and Getting Started page (onboarding)
- [x] **P2: Spec Compliance Audit** — Fixed `variant: 'danger'` → `'destructive'` (4 actions), `columns: string` → `number` (33 form sections), added `type: 'dashboard'` to dashboard
- [x] **P2: Dashboard Widget Spec Alignment** — Added `id`, `title`, `object`, `categoryField`, `valueField`, `aggregate` to all dashboard widgets across CRM, Todo, and Kitchen Sink examples (5 new spec-compliance tests)
- [x] **P2: i18n (10 locales)** — Full CRM metadata translations for en, zh, ja, ko, de, fr, es, pt, ru, ar — objects, fields, fieldOptions, navigation, actions, views, formSections, dashboard, reports, pages (24 tests)
- [x] **P2: Full Examples Metadata Audit** — Systematic spec compliance audit across all 4 examples: added `type: 'dashboard'` + `description` to todo/kitchen-sink dashboards, refactored msw-todo to use `ObjectSchema.create` + `Field.*` with snake_case field names, added explicit views to kitchen-sink and msw-todo, added missing `successMessage` on CRM opportunity action, 21 automated compliance tests

### Ecosystem & Marketplace
- Plugin marketplace website with search, ratings, and install count
- Plugin publishing CLI (`os ui publish`) with automated validation
- 25+ official plugins

### Community Growth
- Official website (www.objectui.org) with interactive playground
- Discord community, monthly webinars, technical blog, YouTube tutorials

### ObjectUI Cloud (2027)
- Project hosting, online editor, Database as a Service
- One-click deployment, performance monitoring
- Billing system (Free / Pro / Enterprise)

### Industry Solutions (2027)
- CRM, ERP, HRM, E-commerce, Project Management accelerators
- AI-powered schema generation from natural language

---

## 📈 Success Metrics

### v1.0 Release Criteria

| Metric | Current | v1.0 Target | How Measured |
|--------|---------|-------------|--------------|
| **Protocol Alignment** | ~85% | 90%+ (UI-facing) | Protocol Consistency Assessment |
| **AppShell Renderer** | ✅ Complete | Sidebar + nav tree from `AppSchema` JSON | Console renders from spec JSON |
| **Designer Interaction** | Phase 2 (most complete) | ViewDesigner + DataModelDesigner drag/undo | Manual UX testing |
| **Build Status** | 42/42 pass | 42/42 pass | `pnpm build` |
| **Test Count** | 5,070+ | 5,618+ | `pnpm test` summary |
| **Test Coverage** | 90%+ | 90%+ | `pnpm test:coverage` |
| **Storybook Stories** | 78 | 91+ (1 per component) | Story file count |
| **Console i18n** | 100% | 100% | No hardcoded strings |

---

## ⚠️ Risk Management

| Risk | Mitigation |
|------|------------|
| AppShell complexity (7 nav types, areas, mobile) | Start with static nav tree, add mobile modes incrementally |
| Designer DnD integration time | Use `@dnd-kit/core` (already proven in Kanban/Dashboard); ViewDesigner first |
| Airtable UX bar is high | Focus on Grid + Kanban + Form triad first; defer Gallery/Timeline polish |
| PWA real sync complexity | Keep simulated sync as fallback; real sync behind feature flag |
| Performance regression | Performance budgets in CI, 10K-record benchmarks |
| View config live preview dependency chain breakage | `generateViewSchema` hardcodes non-grid defaults; per-view-type integration tests required (see P1.8.1) |
| Config property type gaps (`NamedListView` missing fields) | Add first-class properties to `@object-ui/types`; use Zod schema to validate at runtime |

---

## 📚 Reference

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Developer quick reference
- [Plugin Development Guide](./content/docs/guide/plugin-development.mdx)

---

**Roadmap Status:** 🎯 Active — AppShell · Designer Interaction · View Config Live Preview Sync (P1.8.1) · Dashboard Config Panel · Schema-Driven View Config Panel ✅ · Right-Side Visual Editor Drawer ✅ · Airtable UX Parity
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
