# ObjectUI Development Roadmap

> **Last Updated:** February 23, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.9
> **Client Version:** @objectstack/client v3.0.9
> **Target UX Benchmark:** 🎯 Airtable parity
> **Current Priority:** AppShell Navigation · Designer Interaction · View Config Live Preview Sync · Dashboard Config Panel · Airtable UX Polish · **Flow Designer ✅** · **App Creation & Editing Flow ✅**

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** Foundation is **solid and shipping** — 35 packages, 99+ components, 5,700+ tests, 78 Storybook stories, 42/42 builds passing, ~85% protocol alignment. SpecBridge, Expression Engine, Action Engine, data binding, all view plugins (Grid/Kanban/Calendar/Gantt/Timeline/Map/Gallery), Record components, Report engine, Dashboard BI features, mobile UX, i18n (11 locales), WCAG AA accessibility, Designer Phase 1 (ViewDesigner drag-to-reorder ✅), Console through Phase 20 (L3), **AppShell Navigation Renderer** (P0.1), **Flow Designer** (P2.4), **Feed/Chatter UI** (P1.5), and **App Creation & Editing Flow** (P1.11) — all ✅ complete.

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
  - ✅ Semantic fix: `rowHeight` values aligned to spec (`compact`/`medium`/`tall`)
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
5. ~~**ListView toolbar unconditionally rendered:** Search/Filter/Sort buttons always visible regardless of schema flags~~ → Now conditionally rendered based on `schema.showSearch`/`showFilters`/`showSort` (PR #771)
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
- [x] Data section: source, sortBy (expandable), groupBy, prefixField, columns selector (expandable w/ reorder), filterBy (expandable), pagination, searchable/filterable/hidden fields (expandable), quickFilters (expandable), virtualScroll, type-specific options (kanban/calendar/map/gallery/timeline/gantt)
- [x] Appearance section: color, fieldTextColor, rowHeight (icon group), wrapHeaders, showDescription, collapseAllByDefault, striped, bordered, resizable, densityMode, conditionalFormatting (expandable), emptyState (title/message/icon)
- [x] User Actions section: inlineEdit, addDeleteRecordsInline, rowActions (expandable), bulkActions (expandable)
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
- [x] Full affected test suite: 2457 tests across 81 files, all pass

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

**Page Canvas Editor:**
- [x] Component palette (Grid, Kanban, Calendar, Gallery, Dashboard, Form, Layout Grid)
- [x] Component list with drag handles, selection, reorder
- [x] Property panel for selected component (label, type, ID)
- [x] Add/remove/reorder components
- [x] Syncs PageSchema children on every change

**Dashboard Editor:**
- [x] 6 widget types (KPI Metric, Bar Chart, Line Chart, Pie Chart, Table, Grid)
- [x] Widget card grid with selection, drag handles, reorder
- [x] Widget property panel (title, type, data source, value field, aggregate, color variant)
- [x] Add/remove/reorder widgets
- [x] Grid layout based on DashboardSchema columns

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
- [x] `appDesigner` section with 54 keys added to all 10 locales (en, zh, ja, de, fr, es, ar, ru, pt, ko)

**Testing:**
- [x] 9 type tests (isValidAppName, wizardDraftToAppSchema, type shapes)
- [x] 31 AppCreationWizard tests (rendering, steps 1-4, navigation, callbacks, read-only)
- [x] 18 NavigationDesigner tests (rendering, add, remove, groups, badges, read-only)
- [x] 7 EditorModeToggle tests (render, active mode, onChange, accessibility, disabled)
- [x] 14 DashboardEditor tests (rendering, add/remove widgets, property panel, read-only)
- [x] 10 PageCanvasEditor tests (rendering, add/remove components, property panel, read-only)
- [x] 14 ObjectViewConfigurator tests (rendering, view type switch, column visibility, toggles, read-only)
- [x] **Total: 103 new tests, all passing**

**ComponentRegistry:**
- [x] Registered: `app-creation-wizard`, `navigation-designer`, `dashboard-editor`, `page-canvas-editor`, `object-view-configurator`

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

### P2.6 ListView Spec Protocol Gaps (Remaining) ✅

> All items from the ListView Spec Protocol analysis have been implemented.

**P0 — Core Protocol:**
- [x] `data` (ViewDataSchema): ListView consumes `schema.data` — supports `provider: value` (inline items), `provider: object` (fetch from objectName), and plain array shorthand. Falls back to `dataSource.find()` when not set.
- [x] `grouping` rendering: Group button enabled with GroupBy field picker popover. Grouping config wired to ObjectGrid child view, which renders collapsible grouped sections via `useGroupedData` hook.
- [x] `rowColor` rendering: Color button enabled with color-field picker popover. Row color config wired to ObjectGrid child view, which applies row background colors via `useRowColor` hook.

**P1 — Structural Alignment:**
- [x] `quickFilters` structure reconciliation: Auto-normalizes spec `{ field, operator, value }` format into ObjectUI `{ id, label, filters[] }` format. Both formats supported simultaneously.
- [x] `conditionalFormatting` expression reconciliation: Supports spec `{ condition, style }` format alongside ObjectUI field/operator/value rules. `condition` is treated as alias for `expression`, `style` object merged into CSS properties.
- [x] `exportOptions` schema reconciliation: Accepts both spec `string[]` format (e.g., `['csv', 'xlsx']`) and ObjectUI object format `{ formats, maxRecords, includeHeaders, fileNamePrefix }`.
- [x] Column `pinned`: `pinned` property added to ListViewSchema column type. Bridge passes through to ObjectGrid which supports `frozenColumns`.
- [x] Column `summary`: `summary` property added to ListViewSchema column type. Bridge passes through for aggregation rendering.
- [x] Column `link`: ObjectGrid renders click-to-navigate buttons on link-type columns with `navigation.handleClick`. Primary field auto-linked.
- [x] Column `action`: ObjectGrid renders action dispatch buttons via `executeAction` on action-type columns.

**P2 — Advanced Features:**
- [x] `rowActions`: Row-level dropdown action menu per row in ObjectGrid. `schema.rowActions` string array items rendered as dropdown menu items, dispatched via `executeAction`.
- [x] `bulkActions`: Bulk action bar rendered in ListView when rows are selected and `schema.bulkActions` is configured. Fires `onBulkAction` callback with action name and selected rows.
- [x] `sharing` schema reconciliation: Supports both ObjectUI `{ visibility, enabled }` and spec `{ type: personal/collaborative, lockedBy }` models. Share button renders when either `enabled: true` or `type` is set.
- [x] `pagination.pageSizeOptions` backend integration: Page size selector is now a controlled component that dynamically updates `effectivePageSize`, triggering data re-fetch.

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
- [x] **P2: Dashboard Dynamic Data** — "Revenue by Account" widget using `provider: 'object'` aggregation
- [x] **P2: App Branding** — `logo`, `favicon`, `backgroundColor` fields on CRM app
- [x] **P3: Pages** — Settings page (utility) and Getting Started page (onboarding)

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

**Roadmap Status:** 🎯 Active — AppShell · Designer Interaction · View Config Live Preview Sync (P1.8.1) · Dashboard Config Panel · Schema-Driven View Config Panel ✅ · Airtable UX Parity
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
