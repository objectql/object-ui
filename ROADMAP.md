# ObjectUI Development Roadmap

> **Last Updated:** March 1, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.10
> **Client Version:** @objectstack/client v3.0.10
> **Target UX Benchmark:** 🎯 Airtable parity
> **Current Priority:** AppShell Navigation · Designer Interaction · **View Config Live Preview Sync ✅** · Dashboard Config Panel · Airtable UX Polish · **Flow Designer ✅** · **App Creation & Editing Flow ✅** · **System Settings & App Management ✅** · **Right-Side Visual Editor Drawer ✅**

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** Foundation is **solid and shipping** — 35 packages, 99+ components, 6,700+ tests, 80 Storybook stories, 43/43 builds passing, ~85% protocol alignment. SpecBridge, Expression Engine, Action Engine, data binding, all view plugins (Grid/Kanban/Calendar/Gantt/Timeline/Map/Gallery), Record components, Report engine, Dashboard BI features, mobile UX, i18n (11 locales), WCAG AA accessibility, Console through Phase 20 (L3), **AppShell Navigation Renderer** (P0.1), **Flow Designer** (P2.4), **Feed/Chatter UI** (P1.5), **App Creation & Editing Flow** (P1.11), **System Settings & App Management** (P1.12), **Page/Dashboard Editor Console Integration** (P1.11), **Right-Side Visual Editor Drawer** (P1.11), and **Console Engine Schema Integration** (P1.14) — all ✅ complete. **ViewDesigner** has been removed — its capabilities (drag-to-reorder, undo/redo) are now provided by the ViewConfigPanel (right-side config panel).

**What Remains:** The gap to **Airtable-level UX** is primarily in:
1. ~~**AppShell** — No dynamic navigation renderer from spec JSON (last P0 blocker)~~ ✅ Complete
2. **Designer Interaction** — DataModelDesigner has undo/redo, field type selectors, inline editing, Ctrl+S save. ViewDesigner has been removed; its capabilities (drag-to-reorder columns via @dnd-kit, undo/redo via useConfigDraft history) are now integrated into ViewConfigPanel (right-side config panel) ✅
3. ~~**View Config Live Preview Sync** — Config panel changes sync in real-time for Grid, but `showSort`/`showSearch`/`showFilters`/`striped`/`bordered` not yet propagated to Kanban/Calendar/Timeline/Gallery/Map/Gantt (see P1.8.1)~~ ✅ Complete — all 7 phases of P1.8.1 done, 100% coverage across all view types
4. **Dashboard Config Panel** — Airtable-style right-side configuration panel for dashboards (data source, layout, widget properties, sub-editors, type definitions). Widget config live preview sync and scatter chart type switch ✅ fixed (P1.10 Phase 10). Dashboard save/refresh metadata sync ✅ fixed (P1.10 Phase 11). Data provider field override for live preview ✅ fixed (P1.10 Phase 12).
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

## 🔄 Spec v3.0.10 Upgrade Summary

> Upgraded from `@objectstack/spec v3.0.9` → `v3.0.10` on February 25, 2026. UI sub-export adds new Zod schemas and `ViewFilterRule` type. Dashboard widgets now require `id` field. View filters must use object format.

**New Protocol Capabilities (v3.0.10):**

| Area | What's New | Impact on ObjectUI |
|------|------------|-------------------|
| **UI Schemas** | `DensityModeSchema`, `ThemeModeSchema`, `WcagContrastLevelSchema` Zod schemas | Re-exported from `@object-ui/types` for runtime validation |
| **View Filter Rules** | `ViewFilterRule`, `ViewFilterRuleSchema` — structured filter format `{ field, operator, value }` | All view filters migrated from tuple `['field', '=', 'value']` to object format |
| **Dashboard Widgets** | `id` field now required on `DashboardWidgetSchema` | All example dashboard widgets updated with explicit `id` |
| **Filter AST** | `isFilterAST`, `parseFilterAST`, `VALID_AST_OPERATORS` in data sub-export | Filter engine utilities (P2.4) |
| **Multi-Tenant** | `TursoMultiTenantConfig`, `TenantResolverStrategy`, `TenantDatabaseLifecycle` | Cloud multi-tenancy (P2.4) |
| **Contracts** | `IAppLifecycleService`, `IDeployPipelineService`, `IProvisioningService`, `ITenantRouter`, `ISchemaDiffService` | Cloud deployment & lifecycle (P2.4) |

**Breaking Changes Applied:**
- All CRM view filters converted from `['field', '=', 'value']` to `[{ field, operator: '=', value }]`
- All dashboard widgets (kitchen-sink, todo, CRM) given explicit `id` fields
- Todo active filter converted from `[['status', '!=', 'Done']]` to `[{ field: 'status', operator: '!=', value: 'Done' }]`

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

### P1.1 Designer Interaction (DataModelDesigner)

> Source: ROADMAP_DESIGNER Phase 2. ViewDesigner has been removed — its capabilities (column reorder, undo/redo) are now provided by ViewConfigPanel.

**ViewDesigner:** _(Removed — replaced by ViewConfigPanel)_
- [x] Column drag-to-reorder via `@dnd-kit/core` (replace up/down buttons with drag handles)
- [x] Add `Ctrl+S`/`Cmd+S` keyboard shortcut to save
- [x] Add field type selector dropdown with icons from `DESIGNER_FIELD_TYPES`
- [x] Column width validation (min/max/pattern check)
- [x] Removed: ViewDesigner replaced by ViewConfigPanel (right-side config panel)
- [x] ViewConfigPanel upgraded: undo/redo integrated into `useConfigDraft` hook
- [x] ViewConfigPanel upgraded: drag-and-drop column sorting via `@dnd-kit/sortable`

**DataModelDesigner:**
- [x] Entity drag-to-move on canvas
- [x] Inline editing for entity labels (click to edit)
- [x] Field type selector dropdown (replaces hardcoded `'text'` type)
- [x] Confirmation dialogs for destructive actions (delete entity cascades to relationships)

**Shared Infrastructure:**
- [x] Implement `useDesignerHistory` hook (command pattern with undo/redo stacks)
- [x] Wire undo/redo to DataModelDesigner

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
  - [x] Documentation for Feed/Chatter plugin in `content/docs/plugins/plugin-detail.mdx` (purpose/use cases, JSON schema, props, and Console integration for `RecordChatterPanel`, `RecordActivityTimeline`, and related components)
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
- [x] **ListView Navigation Mode Fix** — All 6 navigation modes (page/drawer/modal/split/popover/new_window) now work correctly on row click:
  - ✅ `page` mode navigates to `/record/:recordId` detail page via React Router
  - ✅ `new_window` mode opens correct Console URL in a new browser tab (delegates to `onNavigate`)
  - ✅ `split` mode renders resizable split panels with main content + detail panel
  - ✅ `popover` mode falls back to compact dialog when no `popoverTrigger` is provided
  - ✅ `useNavigationOverlay` hook delegates `new_window` to `onNavigate` when available for app-specific URL control
  - ✅ plugin-view `handleRowClick` supports `split` and `popover` branches

### P1.8 Console — View Config Panel (Phase 20)

- [x] Inline ViewConfigPanel for all view types (Airtable-style right sidebar)
- [x] Column visibility toggle from config panel
- [x] Column reorder (move up/down) from config panel with real-time preview
- [x] Sort/filter/group config from right sidebar
- [x] Type-specific options in config panel (kanban/calendar/map/gallery/timeline/gantt)
- [x] Unified create/edit mode (`mode="create"|"edit"`) — single panel entry point
- [x] Unified data model (`UnifiedViewConfig`) for view configuration
- [x] ViewDesigner removed — its capabilities replaced by ViewConfigPanel (right-side config panel)
- [x] Panel header breadcrumb navigation (Page > List/Kanban/Gallery)
- [x] Collapsible/expandable sections with chevron toggle
- [x] Data section: Sort by (summary), Group by, Prefix field, Fields (count visible)
- [x] Appearance section: Color, Field text color, Row height (icon toggle), Wrap headers, Show field descriptions, Collapse all by default
- [x] User actions section: Edit records inline (→ inlineEdit), Add/delete records inline, Navigation mode (page/drawer/modal/split/popover/new_window/none)
- [x] Calendar endDateField support
- [x] i18n for all 11 locales (en, zh, ja, de, fr, es, ar, ru, pt, ko)
- [x] **Live preview: ViewConfigPanel changes sync in real-time to all list types (Grid/Kanban/Calendar/Timeline/Gallery/Map)** _(all 7 phases complete — see P1.8.1 gap analysis below)_
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
10. ~~**`key={refreshKey}` on PluginObjectView:** Console wrapped PluginObjectView with `key={refreshKey}`, which only changed on save/create, preventing live preview of config changes~~ → Removed `key={refreshKey}`; props changes now flow naturally without remounting (Issue #784)
11. ~~**Navigation overlay not consuming `activeView.navigation`:** Detail overlay only read `objectDef.navigation`, ignoring view-level navigation config~~ → Navigation now uses priority: `activeView.navigation > objectDef.navigation > default drawer` (Issue #784)

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
- [x] Audit all `useMemo`/`useEffect` dependency arrays in `plugin-view/ObjectView.tsx` for missing `activeView` sub-properties — all hooks correctly use whole `activeView` object reference; React shallow equality handles sub-property changes
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

**Phase 10 — Widget Config Live Preview Sync & Type Switch Fix:**
- [x] Fix: `DashboardWithConfig` did not pass `onFieldChange` to `WidgetConfigPanel`, preventing live preview of widget config changes
- [x] Add internal `liveSchema` state to `DashboardWithConfig` for real-time widget preview during editing
- [x] Add `configVersion` counter to stabilize `selectedWidgetConfig` and prevent `useConfigDraft` draft reset loops
- [x] Fix: `scatter` chart type was not handled in `DashboardRenderer` and `DashboardGridLayout` — switching to scatter caused errors
- [x] Add `scatter` to chart type conditions in both `DashboardRenderer.getComponentSchema()` and `DashboardGridLayout.getComponentSchema()`
- [x] Fix: Data binding fields (`categoryField`, `valueField`, `object`, `aggregate`) from config panel did not affect rendering — `getComponentSchema()` only read from `options.xField`/`options.yField`/`options.data`
- [x] Add widget-level field fallbacks: `widget.categoryField || options.xField`, `widget.valueField || options.yField` in both `DashboardRenderer` and `DashboardGridLayout`
- [x] Support object-chart construction from widget-level fields when no explicit data provider exists (e.g. newly created widgets via config panel)
- [x] Support data-table construction from `widget.object` when no data provider exists (table widgets created via config panel)
- [x] Add 7 new Vitest tests: scatter chart (2), widget-level field fallbacks (2), object-chart from widget fields, data-table from widget.object, DashboardWithConfig live preview

**Phase 11 — Dashboard Save/Refresh Metadata Sync:**
- [x] Fix: `saveSchema` in `DashboardView` did not call `metadata.refresh()` after PATCH — closing config panel showed stale data from cached metadata
- [x] Fix: `previewSchema` only used `editSchema` when `configPanelOpen=true` — changed to `editSchema || dashboard` so edits remain visible after panel close until metadata refreshes
- [x] Add `useEffect` to clear stale `editSchema` when metadata refreshes while config panel is closed (seamless transition)
- [x] Clear `editSchema` and config panel state on dashboard navigation (`dashboardName` change)
- [x] Fix: `DashboardDesignPage.saveSchema` did not call `metadata.refresh()` — other pages saw stale dashboard data after save
- [x] Add 5 new Vitest tests: metadata refresh after widget save (2), metadata refresh after widget delete (2), metadata refresh after DashboardDesignPage save (1)

**Phase 12 — Data Provider Field Override for Live Preview:**
- [x] Fix: Widget-level fields (`categoryField`, `valueField`, `aggregate`, `object`) did not override data provider config (`widget.data.aggregate`) — editing these fields in the config panel had no effect on the rendered chart when a data provider was present
- [x] `getComponentSchema()` in `DashboardRenderer` and `DashboardGridLayout` now merges widget-level fields with data provider aggregate config, with widget-level fields taking precedence
- [x] Fix: `objectName` for table/pivot widgets used `widgetData.object || widget.object` — reversed to `widget.object || widgetData.object` so config panel edits to data source are reflected immediately
- [x] Fix: `DashboardWithConfig` did not pass `designMode`, `selectedWidgetId`, or `onWidgetClick` to `DashboardRenderer` — widgets could not be selected or live-previewed in the plugin-level component
- [x] Add 10 new Vitest tests: widget-level field overrides for aggregate groupBy/field/function (3), objectName precedence for chart/table (2), simultaneous field overrides (1), DashboardWithConfig design mode and widget selection (2), existing live preview tests (2)

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

**Phase 7 — Section Restructure & Field Selector Upgrade (Airtable UX Parity):**
- [x] Split monolithic `pageConfig` section into 5 clear sub-sections: General, Toolbar, Navigation, Records, Export & Print
- [x] General section: label, description, viewType (always expanded, non-collapsible)
- [x] Toolbar section: showSearch, showSort, showFilters, showHideFields, showGroup, showColor, showDensity (collapsible)
- [x] Navigation section: navigation mode, width, openNewTab (collapsible)
- [x] Records section: selection mode, addRecord sub-editor (collapsible)
- [x] Export & Print section: allowExport + sub-config, showRecordCount, allowPrinting (collapsible, defaultCollapsed)
- [x] Field selector upgrade: eye/eye-off toggle for visibility (replacing checkboxes), search input for field filtering, Show All/Hide All batch operations, grip handles for visual reorder hints
- [x] i18n keys added for all 11 locales (en, zh, ja, de, fr, es, ar, ru, pt, ko, + ar)
- [x] 110 schema tests pass (+7 new section tests)
- [x] 136 ViewConfigPanel interaction tests pass (updated for eye toggles, section expansion)
- [x] 31 ObjectView integration tests pass (updated for section expansion)
- [x] 10 config-sync integration tests pass

**Phase 8 — Tab Gear Icon, Panel Animation & UX Polish:**
- [x] Add `onConfigView` prop to ViewTabBar with Settings2 gear icon on active tab
- [x] Wire gear icon in ObjectView: click opens ViewConfigPanel for that view's settings
- [x] Panel slide-in/slide-out animation: CSS transition on max-width + opacity (300ms ease-in-out)
- [x] Auto-sync panel content on view tab switch (ViewConfigPanel resets draft when activeView.id changes)
- [x] 5 new ViewTabBar gear icon tests (show on active, hide on inactive, callback, event isolation)
- [x] 3 new ViewConfigPanel tests (search input, Show All, Hide All)
- [x] 49 ViewTabBar tests pass, 139 ViewConfigPanel tests pass, 31 ObjectView tests pass

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
- [x] MSW handler refactored to use `MSWPlugin` + protocol broker shim — filter/sort/top/pagination now work correctly in dev/mock mode (Issue #858)
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

**Empty State & System Route Accessibility (P1.12.1):**
- [x] "Create App" button always shown in empty state (even when config loading fails)
- [x] "System Settings" link always shown alongside "Create App" in empty state
- [x] Top-level `/system/*` routes accessible without any app context (promoted to main routes)
- [x] Top-level `/create-app` route accessible without any app context
- [x] Sidebar fallback navigation with system menu items when no apps are configured
- [x] System pages (`SystemHubPage`, `AppManagementPage`) handle missing `appName` gracefully
- [x] Login/Register/Forgot password pages remain always accessible regardless of app state

**Routes:**
- [x] `/system/` → SystemHubPage
- [x] `/system/apps` → AppManagementPage
- [x] `/system/permissions` → PermissionManagementPage

**Tests:**
- [x] 11 new tests (SystemHubPage, AppManagementPage, PermissionManagementPage)
- [x] Total: 20 system page tests passing

### P1.13 Airtable Grid/List UX Optimization ✅

> **Status:** Complete — Grid/List components now match Airtable UX patterns for date formatting, row interactions, editing, density, headers, filters, and empty states.

**Date Field Humanized Format:**
- [x] `formatDate`, `formatDateTime`, `DateTimeCellRenderer` use browser locale (`undefined` instead of `'en-US'`)
- [x] All date columns auto-format to localized human-readable format (e.g., "2024/2/28 12:57am")

**Row Hover "Open >" Button:**
- [x] Expand button changed from icon-only `<Expand>` to text "Open >" with `<ChevronRight>` icon
- [x] Consistent across Grid and ListView (shown on row hover)

**Single-Click Edit Mode:**
- [x] Added `singleClickEdit` prop to `DataTableSchema` and `ObjectGridSchema`
- [x] When true, clicking a cell enters edit mode (instead of double-click)

**Default Compact Row Height:**
- [x] ObjectGrid default changed from `'medium'` to `'compact'` (32-36px rows)
- [x] ListView default density changed from `'comfortable'` to `'compact'`
- [x] Row height toggle preserved in toolbar

**Single-Click Edit Mode:**
- [x] Added `singleClickEdit` prop to `DataTableSchema` and `ObjectGridSchema`
- [x] ObjectGrid defaults `singleClickEdit` to `true` (click-to-edit by default)
- [x] InlineEditing component already compatible (click-to-edit native)

**Column Header Minimal Style:**
- [x] Headers use `text-xs font-normal text-muted-foreground` (was `text-[11px] font-semibold uppercase tracking-wider`)
- [x] Sort arrows inline with header text

**Filter Pill/Chip Styling:**
- [x] Filter badges use `rounded-full` for Airtable-style pill appearance
- [x] "More" overflow button matches pill styling

**Column Width Auto-Sizing:**
- [x] Auto column width estimation based on header and data content (80-400px range)
- [x] Samples up to 50 rows for width calculation

**Row Selection Checkbox Style:**
- [x] Added `selectionStyle` prop ('always'|'hover') to `DataTableSchema`
- [x] 'hover' mode shows checkboxes only on row hover

**Empty Table Ghost Row:**
- [x] Empty tables show 3 ghost placeholder rows with skeleton-like appearance
- [x] Ghost rows use varying widths for visual variety

### P1.14 Console Integration — Engine Schema Capabilities ✅

> **Status:** Complete — Console now consumes HeaderBarSchema, ViewSwitcher allowCreateView/viewActions, SidebarNav enhanced props, and Airtable UX defaults.

**ViewSwitcher `allowCreateView` & `viewActions`:**
- [x] Added `allowCreateView` and `viewActions` to `ObjectViewSchema` type
- [x] Engine `ObjectView` passes `allowCreateView`/`viewActions` to `ViewSwitcherSchema` builder
- [x] Engine `ObjectView` accepts and passes `onCreateView`/`onViewAction` callbacks to `ViewSwitcher`
- [x] Console `ObjectView` sets `allowCreateView: isAdmin` and `viewActions` (settings/share/duplicate/delete)
- [x] Console wires `onCreateView` → open ViewConfigPanel in create mode
- [x] Console wires `onViewAction('settings')` → open ViewConfigPanel in edit mode

**AppHeader `HeaderBarSchema` Alignment:**
- [x] Console `AppHeader` breadcrumb items typed as engine `BreadcrumbItem` type
- [x] Breadcrumbs with `siblings` dropdown navigation working
- [x] Search triggers ⌘K command palette (desktop + mobile)

**SidebarNav Enhanced Props:**
- [x] Storybook stories for badges, nested items, NavGroups, search filtering
- [x] Documentation updated for `SidebarNav` enhanced API (badges, badgeVariant, children, searchEnabled, NavGroup)

**Airtable UX Defaults Propagation:**
- [x] Verified: Console `ObjectView` does NOT override `rowHeight`, `density`, or `singleClickEdit`
- [x] Engine defaults (`compact` rows, `singleClickEdit: true`, browser locale dates) flow through correctly

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
- [x] ReportConfigPanel: Report type selector (Tabular/Summary/Matrix), visual field picker (multi-select columns), undo/redo, dashboard-style consistency
- [x] ReportView: Live preview linkage fix — config panel changes instantly refresh report preview (title, description, fields, filters, groupBy)
- [x] ReportViewer: Client-side grouping — groupBy config renders grouped table with group headers and row counts
- [x] ReportType added to ReportSchema types (tabular/summary/matrix)
- [x] ReportConfigPanel: Per-column aggregation (sum/avg/count/min/max) in field picker
- [x] ReportConfigPanel: Visual chart editor — chart type selection + X/Y axis field mapping (no JSON editing)
- [x] ReportConfigPanel: Conditional formatting UI — rule builder with field/operator/value + background color
- [x] ReportConfigPanel: Section/block manager — add/remove/reorder header, summary, table, chart, text sections
- [x] ReportViewer: Conditional formatting applied to table cells (background/text color)
- [x] ReportView: Chart config from panel auto-generates chart section in preview
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
- [x] `$expand` auto-injection: `buildExpandFields()` utility in `@object-ui/core` scans schema fields for `lookup`/`master_detail` types and returns field names for `$expand`. Integrated into **all** data-fetching plugins (ListView, ObjectGrid, ObjectKanban, ObjectCalendar, ObjectGantt, ObjectMap, ObjectTimeline, ObjectGallery, ObjectView, ObjectAgGrid) so the backend (objectql) returns expanded objects instead of raw foreign-key IDs. Supports column-scoped expansion (`ListColumn[]` compatible) and graceful fallback when `$expand` is not supported. Cross-repo: objectql engine expand support required for multi-level nesting.

### P2.7 Platform UI Consistency & Interaction Optimization ✅

> All items from the UI consistency optimization (Issue #749) have been implemented.

**Global Theme & Design Tokens:**
- [x] Hardcoded gray colors in `GridField.tsx`, `ReportRenderer.tsx`, and `ObjectGrid.tsx` replaced with theme tokens (`text-muted-foreground`, `bg-muted`, `border-border`, `border-foreground`)
- [x] Global font-family (`Inter`, ui-sans-serif, system-ui) injected in `index.css` `:root`
- [x] `--config-panel-width` CSS custom property added for unified config panel sizing (updated to `320px` in P2.8)
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

### P2.8 Airtable Parity: Product View & Global UI Detail Optimization

> Platform-level grid, toolbar, sidebar, and config panel optimizations for Airtable-level experience (Issue #768).

**Platform: DataTable & ObjectGrid Enhancements:**
- [x] `rowStyle` callback prop added to `DataTableSchema` type — enables inline CSSProperties per row
- [x] `<TableRow>` in data-table.tsx applies `rowStyle` callback for runtime row styling
- [x] ObjectGrid: `conditionalFormatting` rules wired to `rowStyle` — evaluates both spec-format (`condition`/`style`) and ObjectUI-format (`field`/`operator`/`value`) rules per row using `evaluatePlainCondition` from `@object-ui/core`
- [x] Row number (#) column: hover shows `<Checkbox>` for multi-select (when `selectable` mode is enabled), replacing expand icon

**Platform: ListView Toolbar:**
- [x] Visual `<div>` separators (`h-4 w-px bg-border/60`) between toolbar button groups: Search | Hide Fields | Filter/Sort/Group | Color/Density | Export
- [x] Separators conditionally rendered only when adjacent groups are visible
- [x] Inline search moved to toolbar left end (`w-48`, Airtable-style)
- [x] Density button: activated state highlight (`bg-primary/10 border border-primary/20`) when density is non-default
- [x] Merged UserFilters row and tool buttons row into single toolbar line — left: field filter badges, right: tool buttons with separator
- [x] Search changed from inline input to icon button + Popover — saves toolbar space, matches Airtable pattern
- [x] UserFilters `maxVisible` prop added — overflow badges collapse into "More" dropdown with Popover
- [x] Toolbar layout uses flex with `min-w-0` overflow handling for responsive behavior

**Platform: ViewTabBar:**
- [x] Tab "•" dot indicator replaced with descriptive badge (`F`/`S`/`FS`) + tooltip showing "Active filters", "Active sort"

**Platform: Console Sidebar:**
- [x] Recent items section: default collapsed with chevron toggle (saves sidebar space)

**Platform: ViewConfigPanel Advanced Sections:**
- [x] `userActions`, `sharing`, and `accessibility` sections set to `defaultCollapsed: true` — common settings remain expanded, advanced settings folded by default

**Platform: Config Panel Width:**
- [x] `--config-panel-width` CSS variable increased from `280px` to `320px` for wider config panel

**CRM Example: Product Grid Column Configs:**
- [x] All columns upgraded from `string[]` to `ListColumn[]` with explicit `field`, `label`, `width`, `type`, `align`
- [x] `IS ACTIVE`: `type: 'boolean'` for `<Checkbox disabled>` rendering
- [x] Price: `type: 'currency'`, `align: 'right'` for `formatCurrency` formatting
- [x] Default `rowHeight: 'short'` for compact density
- [x] Conditional formatting: stock=0 red, stock<5 yellow warning
- [x] Column widths: NAME 250, SKU 120, CATEGORY 110, PRICE 120, STOCK 80

**Tests:**
- [x] 7 new CRM metadata tests validating column types, widths, rowHeight, conditionalFormatting
- [x] 136 ViewConfigPanel tests updated for defaultCollapsed sections (expand before access)
- [x] 411 ListView + ViewTabBar tests passing (255 plugin-list tests including 9 new toolbar/collapse tests)
- [x] 11 AppSidebar tests passing

### P2.9 Platform UI Navigation & Table Optimization ✅

> Platform-level sidebar, navigation, and grid/table UX improvements (Issue #XX).

**Sidebar Navigation:**
- [x] Pin icons show-on-hover: `SidebarMenuAction` in `NavigationRenderer` now uses `showOnHover={!item.pinned}` — unpinned items show pin icon only on hover; pinned items always show unpin icon. Applied to both `action` and leaf navigation item types.
- [x] Search placeholder contrast: Search icon in AppSidebar improved from `opacity-50` → `opacity-70` for better readability.
- [x] Recent section position: Recent items section moved above Record Favorites in AppSidebar for quicker access to recently visited items.
- [x] Favorites section: Already hides automatically when no pinned items exist (verified).
- [x] Resizable sidebar width: `SidebarRail` enhanced with pointer-event drag-to-resize (min 200px, max 480px). Width persisted to `localStorage`. Click toggles sidebar, double-click resets to default. `useSidebar()` hook now exposes `sidebarWidth` and `setSidebarWidth`.

**Grid/Table Field Inference:**
- [x] Percent field auto-inference: `inferColumnType()` in ObjectGrid now detects fields with names containing `probability`, `percent`, `percentage`, `completion`, `progress`, `rate` and assigns `PercentCellRenderer` with progress bar display.
- [x] ISO datetime fallback: ObjectGrid `inferColumnType()` now detects ISO 8601 datetime strings (`YYYY-MM-DDTHH:MM`) in data values as a catch-all for fields whose names don't match date/datetime patterns.
- [x] Date/datetime human-friendly display: `DateCellRenderer` (relative format) and `DateTimeCellRenderer` (split date/time) already registered in field registry for all grid/table views.
- [x] Currency/status/boolean renderers: Already implemented with proper formatting (currency symbol, Badge colors, checkbox display).
- [x] **accessorKey-format type inference**: `generateColumns()` in ObjectGrid now applies `inferColumnType()` + `getCellRenderer()` to `accessorKey`-format columns that don't already have a `cell` renderer. Previously, `accessorKey` columns bypassed the entire inference pipeline, showing raw dates, plain text status/priority, and raw numbers for progress.
- [x] **humanizeLabel() utility**: New `humanizeLabel()` export in `@object-ui/fields` converts snake_case/kebab-case values to Title Case (e.g., `in_progress` → `In Progress`). Used as fallback in `SelectCellRenderer` when no explicit `option.label` exists.
- [x] **PercentCellRenderer progress-field normalization**: `PercentCellRenderer` now uses field name to disambiguate 0-1 fraction vs 0-100 whole number — fields matching `/progress|completion/` treat values as already in 0-100 range (e.g., `75` → `75%`), while other fields like `probability` still treat `0.75` → `75%`.

**Header & Breadcrumb i18n:**
- [x] AppHeader breadcrumb labels (`Dashboards`, `Pages`, `Reports`, `System`) now use `t()` translation via `useObjectTranslation`.
- [x] `console.breadcrumb` i18n keys added to all 11 locales (en, zh, ja, ko, de, fr, es, pt, ru, ar).
- [x] `header-bar` renderer: `resolveCrumbLabel()` handles both string and `I18nLabel` objects for breadcrumb labels.
- [x] `breadcrumb` renderer: `resolveItemLabel()` handles both string and `I18nLabel` objects for item labels.

**Tests:**
- [x] 46 NavigationRenderer tests passing (pin/favorites/search/reorder)
- [x] 86 field cell renderer tests passing (date/datetime/select/boolean/percent/humanizeLabel/progress)
- [x] 293 ObjectGrid tests passing (inference, rendering, accessibility, accessorKey-format inference)
- [x] 28 DataTable tests passing
- [x] 78 Layout tests passing (NavigationRenderer + AppSchemaRenderer)
- [x] 11 AppSidebar tests passing
- [x] 32 i18n tests passing

### P2.10 ActionBar Rendering & useActionEngine Integration ✅

> Location-aware action toolbar component and React hook for ActionEngine.
> Bridges ActionSchema metadata → visible, clickable action buttons at all defined locations.

- [x] `action:bar` component — Composite toolbar renderer that accepts `ActionSchema[]` + `location` filter
  - Filters actions by `ActionLocation` (list_toolbar, list_item, record_header, record_more, record_related, global_nav)
  - Resolves each action's `component` type (action:button, action:icon, action:menu, action:group) via ComponentRegistry
  - Overflow support: actions beyond `maxVisible` threshold grouped into "More" dropdown (action:menu)
  - Supports horizontal/vertical direction, gap, variant/size defaults, custom className
  - WCAG: `role="toolbar"` + `aria-label="Actions"`
  - Registered in ComponentRegistry with inputs/defaultProps for Designer/Studio integration
- [x] `useActionEngine` hook — React wrapper around `ActionEngine`
  - `getActionsForLocation(location)` — returns filtered, priority-sorted actions
  - `getBulkActions()` — returns bulk-enabled actions
  - `executeAction(name)` — executes by name with optional context override
  - `handleShortcut(keys)` — keyboard shortcut dispatch
  - Memoized engine instance, stable callbacks
- [x] Tests: 23 tests (12 ActionBar, 11 useActionEngine) covering registration, rendering, location filtering, overflow, styling, execution, shortcuts

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
- [x] **P2: Fix Revenue by Account Chart** — Fixed 3 bugs preventing "Revenue by Account" chart from displaying data: (1) ObjectChart `extractRecords()` now handles `results.data` and `results.value` response formats in addition to `results.records`, (2) DashboardRenderer auto-adapts series `dataKey` from `aggregate.field` when aggregate config is present, (3) CRM dashboard `yField` aligned to aggregate field `amount` (was `total`). Centralized `extractRecords()` utility in `@object-ui/core` and unified data extraction across all 6 data components (ObjectChart, ObjectMap, ObjectCalendar, ObjectGantt, ObjectTimeline, ObjectKanban). Added 16 new tests.
- [x] **P2: App Branding** — `logo`, `favicon`, `backgroundColor` fields on CRM app
- [x] **P3: Pages** — Settings page (utility) and Getting Started page (onboarding)
- [x] **P2: Spec Compliance Audit** — Fixed `variant: 'danger'` → `'destructive'` (4 actions), `columns: string` → `number` (33 form sections), added `type: 'dashboard'` to dashboard
- [x] **P2: Dashboard Widget Spec Alignment** — Added `id`, `title`, `object`, `categoryField`, `valueField`, `aggregate` to all dashboard widgets across CRM, Todo, and Kitchen Sink examples (5 new spec-compliance tests)
- [x] **P2: i18n (10 locales)** — Full CRM metadata translations for en, zh, ja, ko, de, fr, es, pt, ru, ar — objects, fields, fieldOptions, navigation, actions, views, formSections, dashboard, reports, pages (24 tests)
- [x] **P2: Full Examples Metadata Audit** — Systematic spec compliance audit across all 4 examples: added `type: 'dashboard'` + `description` to todo/kitchen-sink dashboards, refactored msw-todo to use `ObjectSchema.create` + `Field.*` with snake_case field names, added explicit views to kitchen-sink and msw-todo, added missing `successMessage` on CRM opportunity action, 21 automated compliance tests
- [x] **P2: CRM Dashboard Full provider:'object' Adaptation** — Converted all chart and table widgets in CRM dashboard from static `provider: 'value'` to dynamic `provider: 'object'` with aggregation configs. 12 widgets total: 4 KPI metrics (static), 7 charts (sum/count/avg/max aggregation across opportunity, product, order objects), 1 table (dynamic fetch). Cross-object coverage (order), diverse aggregate functions (sum, count, avg, max). Fixed table `close_date` field alignment. Added i18n for 2 new widgets (10 locales). 9 new CRM metadata tests, 6 new DashboardRenderer rendering tests (area/donut/line/cross-object + edge cases). All provider:'object' paths covered.
- [x] **P1: Dashboard provider:'object' Crash & Blank Rendering Fixes** — Fixed 3 critical bugs causing all charts to be blank and tables to crash on provider:'object' dashboards: (1) DashboardRenderer `...options` spread was leaking provider config objects as `data` in data-table and pivot schemas — fixed by destructuring `data` out before spread, (2) DataTableRenderer and PivotTable now guard with `Array.isArray()` for graceful degradation when non-array data arrives, (3) ObjectChart now shows visible loading/warning messages instead of silently rendering blank when `dataSource` is missing. Also added provider:'object' support to DashboardGridLayout (charts, tables, pivots). 2 new regression tests.
- [x] **P1: Dashboard Widget Data Blank — useDataScope/dataSource Injection Fix** — Fixed root cause of dashboard widgets showing blank data with no server requests: `useDataScope(undefined)` was returning the full context `dataSource` (service adapter) instead of `undefined` when no bind path was given, causing ObjectChart and all data components (ObjectKanban, ObjectGallery, ObjectTimeline, ObjectGrid) to treat the adapter as pre-bound data and skip async fetching. Fixed `useDataScope` to return `undefined` when no path is provided. Also improved ObjectChart fault tolerance: uses `useContext` directly instead of `useSchemaContext` (no throw without provider), validates `dataSource.find` is callable before invoking. 14 new tests (7 useDataScope + 7 ObjectChart data fetch/fault tolerance).
- [x] **P1: URL-Driven Debug/Developer Panel** — Universal debug mode activated via `?__debug` URL parameter (amis devtools-style). `@object-ui/core`: exported `DebugFlags`, `DebugCollector` (perf/expr/event data collection, tree-shakeable), `parseDebugFlags()`, enhanced `isDebugEnabled()` (URL → globalThis → env resolution, SSR-safe). `@object-ui/react`: `useDebugMode` hook with URL detection, Ctrl+Shift+D shortcut, manual toggle; `SchemaRendererContext` extended with `debugFlags`; `SchemaRenderer` injects `data-debug-type`/`data-debug-id` attrs + reports render perf to `DebugCollector` when debug enabled. `@object-ui/components`: floating `DebugPanel` with 7 built-in tabs (Schema, Data, Perf, Expr, Events, Registry, Flags), plugin-extensible via `extraTabs`. Console `MetadataInspector` auto-opens when `?__debug` detected. Fine-grained sub-flags: `?__debug_schema`, `?__debug_perf`, `?__debug_data`, `?__debug_expr`, `?__debug_events`, `?__debug_registry`. 48 new tests.
- [x] **P1: Chart Widget Server-Side Aggregation** — Fixed chart widgets (bar/line/area/pie/donut/scatter) downloading all raw data and aggregating client-side. Added optional `aggregate()` method to `DataSource` interface (`AggregateParams`, `AggregateResult` types) enabling server-side grouping/aggregation via analytics API (e.g. `GET /api/v1/analytics/{resource}?category=…&metric=…&agg=…`). `ObjectChart` now prefers `dataSource.aggregate()` when available, falling back to `dataSource.find()` + client-side aggregation for backward compatibility. Implemented `aggregate()` in `ValueDataSource` (in-memory), `ApiDataSource` (HTTP), and `ObjectStackAdapter` (analytics API with client-side fallback). Only detail widgets (grid/table/list) continue to fetch full data. 9 new tests.
- [x] **P1: Spec-Aligned CRM I18n** — Fixed CRM internationalization not taking effect on the console. Root cause: CRM metadata used plain string labels instead of spec-aligned `I18nLabel` objects. Fix: (1) Updated CRM app/dashboard/navigation metadata to use `I18nLabel` objects (`{ key, defaultValue }`) per spec. (2) Updated `NavigationItem` and `NavigationArea` types to support I18nLabel. (3) Added `resolveLabel()` helper in NavigationRenderer. (4) Updated `resolveI18nLabel()` to accept `t()` function for translation. (5) Added `loadLanguage` callback in I18nProvider for API-based translation loading. (6) Added `/api/v1/i18n/:lang` endpoint to mock server. Console contains zero CRM-specific code.
- [x] **P0: Opportunity List View & ObjectDef Column Enrichment** — Fixed ObjectGrid not using objectDef field metadata for type-aware rendering when columns are `string[]` or `ListColumn[]` without full options. (1) Schema resolution always fetches full schema from DataSource for field type metadata. (2) String[] column path enriched with objectDef types, options (with colors), currency, precision for proper CurrencyCellRenderer, SelectCellRenderer (colored badges), PercentCellRenderer, DateCellRenderer. (3) ListColumn[] fieldMeta deep-merged with objectDef field properties (select options with colors, currency code, precision). (4) Opportunity view columns upgraded from bare `string[]` to `ListColumn[]` with explicit types, alignment, and summary aggregation. 9 new tests.

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
| **Designer Interaction** | Phase 2 (most complete) | DataModelDesigner drag/undo; ViewDesigner removed (replaced by ViewConfigPanel) | Manual UX testing |
| **Build Status** | 43/43 pass | 43/43 pass | `pnpm build` |
| **Test Count** | 6,700+ | 6,700+ | `pnpm test` summary |
| **Test Coverage** | 90%+ | 90%+ | `pnpm test:coverage` |
| **Storybook Stories** | 80 | 91+ (1 per component) | Story file count |
| **Console i18n** | 100% | 100% | No hardcoded strings |

---

## 🐛 Bug Fixes

### Default Navigation Mode (Page) Clicks Have No Effect — Stale Closure (February 2026)

**Root Cause:** Three compounding issues created a stale closure chain in `ObjectView.tsx`:
1. `{ mode: 'page' }` fallback created a new object literal every render, causing `useNavigationOverlay`'s `handleClick` `useCallback` to be recreated with potentially stale deps.
2. The `onNavigate` callback was an inline arrow function with unstable identity, so React could batch-skip the render where `handleClick` picks up the fresh closure.
3. Cascade instability: `navOverlay` (from `useMemo`) got a new reference every render because its deps (`handleClick`, etc.) changed, propagating stale closures through `renderListView`.

**Fix:** Memoized `detailNavigation` with `useMemo` (stable reference for the `{ mode: 'page' }` fallback) and extracted `onNavigate` into a `useCallback` (`handleNavOverlayNavigate`) with `[navigate, viewId]` deps. This ensures stable identities for both inputs to `useNavigationOverlay`, preventing stale closures.

**Tests:** Added 2 stale closure prevention tests in `useNavigationOverlay.test.ts`: (1) verify `handleClick` uses latest `onNavigate` after re-render with new callback, (2) verify navigation works after config changes from undefined to explicit page mode. All 31 useNavigationOverlay tests and 739 console tests pass.

### ListView Grouping Config Not Taking Effect (February 2026)

**Root Cause:** `viewComponentSchema` `useMemo` in `ListView.tsx` was missing `groupingConfig`, `rowColorConfig`, and `navigation.handleClick` in its dependency array. When users toggled grouping fields via the toolbar popover, the state changed but the memoized schema was not recomputed, so the child grid/kanban/gallery never received the updated grouping config.

**Fix:** Added `groupingConfig`, `rowColorConfig`, and `navigation.handleClick` to the `useMemo` dependency array at line 856 of `ListView.tsx`.

**Tests:** Added integration test in `ListViewGroupingPropagation.test.tsx` that verifies toggling a group field via the toolbar immediately updates the rendered schema. All 117 ListView tests pass.

### List View Row Click Not Navigating to Record Detail (February 2026)

**Root Cause:** `onRowClick` in both `PluginObjectView` (line 772) and `renderListView` (line 599) of `ObjectView.tsx` fell back to `onEdit` / `editHandler`, which only opens an edit form. The `navOverlay.handleClick` from `useNavigationOverlay` — which handles drawer/modal/page navigation modes — was never connected to these click handlers. Additionally, the `useNavigationOverlay` hook was missing the `onNavigate` callback needed for `mode: 'page'` to update the URL.

**Fix:** Replaced `onEdit`/`editHandler` fallbacks with `navOverlay.handleClick` in both row click handlers, added `onNavigate` callback to `useNavigationOverlay` that sets the `recordId` URL search parameter, and added `navOverlay` to the `renderListView` useCallback dependency array.

**Tests:** All 32 ObjectView tests and 29 useNavigationOverlay tests pass.

### App.tsx handleRowClick Overriding All Navigation Modes (February 2026)

**Root Cause:** `App.tsx` defined a `handleRowClick` that hardcoded `setSearchParams({recordId})` (drawer-only behavior) and passed it unconditionally to `<ObjectView>` via `onRowClick={handleRowClick}`. This overrode the internal `navOverlay.handleClick` in Console's `ObjectView`, preventing page/modal/split/popover/new_window navigation modes from working.

**Fix:** Removed `handleRowClick` from `App.tsx` and the `onRowClick` prop from both `<ObjectView>` route elements. Updated Console `ObjectView` to always use `navOverlay.handleClick` (3 locations) instead of falling back to the external `onRowClick` prop. Removed the unused `onRowClick` prop from the `ObjectView` function signature.

**Tests:** All 42 ObjectView tests and 33 useNavigationOverlay tests pass (3 new tests added).

### ListView Multi-Navigation Mode Support — split/popover/page/new_window (February 2026)

**Root Cause:** While `drawer`/`modal` modes worked in the Console ObjectView, the remaining 4 navigation modes had gaps:
1. Console's `onNavigate` callback relied on implicit fallthrough for `view` action (page mode) — not explicit.
2. `PluginObjectView`'s `formLayout` only mapped `drawer`/`modal` modes; `split`/`popover` fell through to the default layout (`drawer`), rendering the wrong overlay type.
3. `PluginObjectView` lacked `NavigationOverlay` integration for `split` (resizable side-by-side panels) and `popover` (compact dialog preview).

**Fix:**
- Console `onNavigate` now explicitly checks for `action === 'view'` (page mode) alongside the existing `'new_window'` check.
- `PluginObjectView` `formLayout` now includes `split` and `popover` branches.
- `PluginObjectView` imports and renders `NavigationOverlay` from `@object-ui/components` for both `split` mode (with `mainContent` wrapping the grid) and `popover` mode (Dialog fallback when no `popoverTrigger`).
- Split mode close button properly resets form state via `handleFormCancel`.

**Tests:** Updated split/popover tests to verify `NavigationOverlay` rendering (close panel button for split, dialog role for popover). Added split close-and-return test. All 29 PluginObjectView tests and 37 Console ObjectView tests pass.

### ListView Grouping Mode Empty Rows (February 2026)

**Root Cause:** When grouping is enabled in list view, `buildGroupTableSchema` in `ObjectGrid.tsx` sets `pagination: false` but inherits `pageSize: 10` from the parent schema. The `DataTableRenderer` filler row logic (`Array.from({ length: Math.max(0, pageSize - paginatedData.length) })`) pads each group table with empty rows up to `pageSize`, creating many blank lines.

**Fix:** Added `pagination &&` condition to filler row rendering in `data-table.tsx`. Filler rows only render when pagination is enabled, since their purpose is maintaining consistent page height during paginated views.

**Tests:** Added 2 tests in `data-table-airtable-ux.test.tsx` verifying filler rows are skipped when pagination is off and still rendered when pagination is on. All 59 related tests pass.

### Metric Widget I18nLabel Render Crash (February 2026)

**Root Cause:** `MetricWidget` and `MetricCard` rendered I18nLabel objects (`{key, defaultValue}`) directly as React children. When CRM dashboard metadata used I18nLabel objects for `trend.label` (e.g. `{ key: 'crm.dashboard.trendLabel', defaultValue: 'vs last month' }`), React threw error #31 ("Objects are not valid as a React child").

**Fix:** Added `resolveLabel()` helper to `MetricWidget.tsx` and `MetricCard.tsx` that converts I18nLabel objects to plain strings before rendering. Updated prop types to accept both string and I18nLabel objects for `label`, `description`, and `trend.label`.

**Tests:** Added 3 new tests: 1 in `DashboardRenderer.widgetData.test.tsx` verifying metric widgets with I18nLabel trend labels render correctly, and 2 in `MetricCard.test.tsx` verifying I18nLabel resolution for title and description. All 159 dashboard tests pass.

### Field Type Display Issues — Lookup, User, Select, Status Renderers (February 2026)

**Root Cause:** Multiple renderer defects caused incorrect field value display across views:

1. **`LookupCellRenderer`** — Destructured only `value`, ignoring the `field` prop. When the API returned a raw primitive ID (e.g. `customer: 2`), the renderer fell through to `String(value)` and showed `"2"` instead of the related record's name. No attempt was made to resolve IDs via `field.options`.

2. **`UserCellRenderer`** — Did not guard against primitive values (number/string user IDs). Accessing `.name` / `.username` on a number returned `undefined`, silently falling through to `"User"` as the generic label.

3. **`getCellRenderer` standardMap** — `lookup` and `master_detail` were mapped to `SelectCellRenderer` instead of `LookupCellRenderer` in the fallback map. Although the fieldRegistry pre-registration shadowed this bug, it was semantically incorrect.

4. **`status`, `user`, `owner` types** — Not pre-registered in `fieldRegistry`. All went through the `standardMap` path, making their association with renderers implicit and invisible.

**Fix:**
- `LookupCellRenderer`: now accepts the `field` prop and resolves primitive IDs against `field.options` (matching by `String(opt.value) === String(val)` for type-safe comparison). Arrays of primitive IDs are resolved via the same logic. Null/empty-string guard updated from `!value` to `value == null || value === ''` to handle `0` correctly.
- `UserCellRenderer`: primitive values (typeof !== 'object') return a plain `<span>` with the string representation. Array items that are not objects are also handled gracefully.
- `getCellRenderer` standardMap: `lookup` and `master_detail` now correctly reference `LookupCellRenderer`.
- `fieldRegistry` now explicitly registers `status` → `SelectCellRenderer`, `user` → `UserCellRenderer`, and `owner` → `UserCellRenderer` alongside the existing `lookup`/`master_detail`/`select` registrations.

**Tests:** Added 36 new tests in `cell-renderers.test.tsx`:
- `getCellRenderer` registry assertions for `lookup`, `master_detail`, `status`, `user`, `owner` types
- `TextCellRenderer`: null, undefined, empty string, numeric zero (0 renders "0" not "-"), boolean false
- `LookupCellRenderer`: null, empty-string, primitive ID (number), primitive ID (string), unresolved primitive, object with name/label/_id, array of objects, array of primitive IDs resolved via options
- `UserCellRenderer`: null, primitive number ID, primitive string ID, object with name, object with username, array of user objects

5. **`TextCellRenderer`** — Used `value || '-'` which incorrectly rendered `'-'` for numeric `0` (falsy zero). Updated to `(value != null && value !== '') ? String(value) : '-'` for consistent null-only suppression.

All 313 `@object-ui/fields` tests pass.

### ListView Airtable-Style Toolbar Opt-In & Duplicate Record Count (February 2026)

**Root Cause (1 — Toolbar defaults):** `showHideFields`, `showColor`, and `showDensity` in `ListView.tsx` used opt-out logic (`!== false`), making secondary toolbar buttons visible by default. Airtable hides these controls unless explicitly enabled.

**Fix:** Changed default logic from `!== false` (opt-out) to `=== true` (opt-in) for `showHideFields`, `showColor`, and `showDensity` in the `toolbarFlags` computation. Updated `@default` JSDoc comments in `NamedListView` and `ListViewSchema` interfaces from `@default true` to `@default false`.

**Root Cause (2 — Duplicate record count):** Both `ListView.tsx` (`record-count-bar`) and `ObjectView.tsx` (`record-count-footer`) independently rendered the record count at the bottom, causing duplicate display.

**Fix:** Removed the `record-count-footer` from `ObjectView.tsx` since `ListView` already renders the authoritative `record-count-bar`.

**Tests:** Updated 11 tests across `ListView.test.tsx` and `ObjectView.test.tsx`. All 112 ListView tests and 32 ObjectView tests pass.

---

### DetailView Rendering Optimization (March 2026)

> Platform-level DetailView enhancements: auto-grouping from form sections, empty value hiding, smart header with primaryField/summaryFields, responsive breakpoint fix, and activity timeline collapse.

**Types (`@object-ui/types`):**
- [x] `DetailViewSection.hideEmpty?: boolean` — filter null/undefined/empty string fields; hide empty sections
- [x] `DetailViewSchema.primaryField?: string` — record-level title from data field
- [x] `DetailViewSchema.summaryFields?: string[]` — render key attributes as Badge in header

**DetailSection (`@object-ui/plugin-detail`):**
- [x] `hideEmpty` filtering: fields with null/undefined/empty string values are removed; section returns null when all fields hidden
- [x] Responsive breakpoint fix: `sm:grid-cols-2` → `md:grid-cols-2`, `sm:grid-cols-2 md:grid-cols-3` → `md:grid-cols-2 lg:grid-cols-3` (correct behavior on iPad+sidebar)

**DetailView Header (`@object-ui/plugin-detail`):**
- [x] Header renders `data[primaryField]` as h1 title (falls back to `schema.title`)
- [x] `summaryFields` rendered as `<Badge variant="secondary">` next to title

**RecordActivityTimeline (`@object-ui/plugin-detail`):**
- [x] `collapseWhenEmpty` prop: suppress "No activity recorded" message when true, showing only comment input

**RecordDetailView (`apps/console`):**
- [x] Read `objectDef.views?.form?.sections` for section grouping; fallback to flat field list
- [x] Remove `columns: 2` hardcode — let `autoLayout` infer optimal columns
- [x] Auto-detect `primaryField` from object fields (name/title)

**Field Renderers (`@object-ui/fields`):**
- [x] `EmailCellRenderer`: mailto link + hover copy-to-clipboard button
- [x] `PhoneCellRenderer`: tel link with call icon + hover copy-to-clipboard button
- [x] `BooleanCellRenderer`: warning Badge for active/enabled/verified fields when false (e.g. "Active — Off")

**Tests:** 94 plugin-detail tests passing (11 new), 100 field renderer tests passing (12 new) covering hideEmpty filtering, empty section hiding, primaryField/summaryFields rendering, responsive breakpoints, collapseWhenEmpty, autoLayout undefined-columns regression, email copy, phone copy+icon, boolean warning badge.

**Storybook:** Added `PrimaryFieldWithBadges` and `HideEmptyFields` stories.

---

## ⚠️ Risk Management

| Risk | Mitigation |
|------|------------|
| AppShell complexity (7 nav types, areas, mobile) | Start with static nav tree, add mobile modes incrementally |
| Designer DnD integration time | Use `@dnd-kit/core` (already proven in Kanban/Dashboard) |
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

**Roadmap Status:** 🎯 Active — AppShell ✅ · Designer Interaction · View Config Live Preview Sync ✅ · Dashboard Config Panel ✅ · Schema-Driven View Config Panel ✅ · Right-Side Visual Editor Drawer ✅ · Feed/Chatter Documentation ✅ · Airtable UX Parity
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
