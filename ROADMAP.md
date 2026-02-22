# ObjectUI Development Roadmap

> **Last Updated:** February 22, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.9
> **Client Version:** @objectstack/client v3.0.9
> **Target UX Benchmark:** 🎯 Airtable parity
> **Current Priority:** AppShell Navigation · Designer Interaction · View Config Live Preview Sync · Dashboard Config Panel · Airtable UX Polish · **Flow Designer ✅**

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** Foundation is **solid and shipping** — 35 packages, 91+ components, 5,110+ tests, 78 Storybook stories, 42/42 builds passing, ~85% protocol alignment. SpecBridge, Expression Engine, Action Engine, data binding, all view plugins (Grid/Kanban/Calendar/Gantt/Timeline/Map/Gallery), Record components, Report engine, Dashboard BI features, mobile UX, i18n (11 locales), WCAG AA accessibility, Designer Phase 1 (ViewDesigner drag-to-reorder ✅), Console through Phase 20 (L3), **AppShell Navigation Renderer** (P0.1), and **Flow Designer** (P2.4) — all ✅ complete.

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
- [x] User actions section: Edit records inline, Add/delete records inline, Click into record details
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
  - ⚠️ No per-view-type integration tests verifying config properties reach non-grid renderers
- [ ] Conditional formatting rules

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
- [ ] Add integration test: ViewConfigPanel kanban config change → Kanban renderer receives updated props

**Phase 3 — Calendar Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` calendar branch
- [x] Pass `filter`/`sort`/appearance properties to calendar renderer in real-time
- [x] Verify `startDateField`/`endDateField` config changes trigger re-render via `useMemo` deps
- [ ] Add integration test: ViewConfigPanel calendar config change → Calendar renderer receives updated props

**Phase 4 — Timeline/Gantt Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` timeline/gantt branches
- [x] Pass appearance properties (`color`, `striped`, `bordered`) through `renderListView` schema
- [x] Ensure `dateField`/`startDateField`/`endDateField` config changes trigger re-render
- [ ] Add integration tests for timeline and gantt config sync

**Phase 5 — Gallery & Map Live Preview:**
- [x] Propagate `showSort`/`showSearch`/`showFilters` through `generateViewSchema` gallery/map branches
- [x] Pass appearance properties through `renderListView` schema for gallery/map
- [x] Ensure gallery `imageField`/`titleField` and map `locationField`/`zoom`/`center` config changes trigger re-render
- [ ] Add integration tests for gallery and map config sync

**Phase 6 — Data Flow & Dependency Refactor:**
- [x] Add `showSearch`/`showSort`/`showFilters`/`striped`/`bordered`/`color` to `NamedListView` type in `@object-ui/types`
- [x] Add `showHideFields`/`showGroup`/`showColor`/`showDensity`/`allowExport` to `NamedListView` and `ListViewSchema` types and Zod schema (Issue #719)
- [x] Add `inlineEdit`/`wrapHeaders`/`clickIntoRecordDetails`/`addRecordViaForm`/`addDeleteRecordsInline`/`collapseAllByDefault`/`fieldTextColor`/`prefixField`/`showDescription` to `NamedListView` and `ListViewSchema` types and Zod schema (Issue #719)
- [x] Update Console `renderListView` to pass all config properties in `fullSchema`
- [ ] Audit all `useMemo`/`useEffect` dependency arrays in `plugin-view/ObjectView.tsx` for missing `activeView` sub-properties
- [x] Remove hardcoded `showSearch: false` from `generateViewSchema` — use `activeView.showSearch ?? schema.showSearch` instead

**Phase 7 — End-to-End Integration Tests:**
- [ ] Per-view-type test: Grid config sync (showSort, showSearch, showFilters, striped, bordered)
- [ ] Per-view-type test: Kanban config sync (groupBy, color, showSearch)
- [ ] Per-view-type test: Calendar config sync (startDateField, endDateField, showFilters)
- [ ] Per-view-type test: Timeline/Gantt config sync (dateField, appearance)
- [ ] Per-view-type test: Gallery config sync (imageField, titleField, appearance)
- [ ] Per-view-type test: Map config sync (locationField, zoom, center, appearance)
- [ ] Cross-view-type test: Switch view type in ViewConfigPanel → verify config properties transfer correctly

### P1.10 Console — Dashboard Config Panel

> Airtable-style right-side configuration panel for dashboards. Phased rollout from shared infrastructure to full type-safe editing.

**Phase 0 — Component Infrastructure:**
- [x] Extract `ConfigRow` / `SectionHeader` from `ViewConfigPanel` into `@object-ui/components` as reusable primitives

**Phase 1 — Dashboard-Level Config Panel:**
- [ ] Develop `DashboardConfigPanel` supporting data source, layout (columns/gap), filtering, appearance, user filters & actions

**Phase 2 — Widget-Level Configuration:**
- [ ] Support click-to-select widget → sidebar switches to widget property editor (title, type, data binding, layout)

**Phase 3 — Sub-Editor Integration:**
- [ ] Integrate `FilterBuilder` for dashboard global filters
- [ ] Dropdown filter selector and action button sub-panel visual editing

**Phase 4 — Composition & Storybook:**
- [ ] Build `DashboardWithConfig` composite component (dashboard + config sidebar)
- [ ] Add Storybook stories for `DashboardConfigPanel` and `DashboardWithConfig`

**Phase 5 — Type Definitions & Validation:**
- [x] Add `DashboardConfig` types to `@object-ui/types`
- [x] Add Zod schema validation for `DashboardConfig`

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
| **Test Count** | 5,070+ | 5,500+ | `pnpm test` summary |
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

**Roadmap Status:** 🎯 Active — AppShell · Designer Interaction · View Config Live Preview Sync (P1.8.1) · Dashboard Config Panel · Airtable UX Parity
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
