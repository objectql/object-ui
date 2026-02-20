# ObjectUI Development Roadmap

> **Last Updated:** February 20, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.8
> **Client Version:** @objectstack/client v3.0.8
> **Current Priority:** 🎯 v1.0 UI Essentials · Spec Protocol Alignment · SpecBridge · Action Engine · Expression Engine

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** The component foundation is solid — 35 packages, 91+ components, 200+ test files, 68 Storybook stories, and all 42 builds passing. Atom components, layout primitives, DX, mobile UX, and component polish are ✅ complete. However, a **Protocol Consistency Assessment** (Feb 20, 2026) comparing `@objectstack/spec` with ObjectUI's renderer implementation revealed **~20% overall alignment** at the protocol level. While Shadcn-based UI primitives are excellent, the critical bridge layers — App Shell, Action Engine, Expression Engine, Data Binding, and metadata-driven views — have significant gaps or zero implementation.

**What's Next:** Priorities have been reorganized (Feb 20, 2026) to focus on **protocol alignment and the SpecBridge** — the translation layer that transforms `@objectstack/spec` JSON into ObjectUI renderer props. This is the #1 blocker for Console development from real metadata. The re-prioritized focus is:

1. **🎯 P0: v1.0 UI Essentials + SpecBridge** — Build the `@object-ui/react` SpecBridge, AppShell renderer, Expression Engine, and Action Runtime — the minimum infrastructure to render a Console from spec JSON
2. **📐 P1: Spec Protocol Alignment** — Align all view plugins with `@objectstack/spec` contracts: ListView/FormView/Dashboard data binding, record components, i18n/ARIA support
3. **🧩 P2: Advanced Views & Features** — Gallery, Timeline, Gantt, Map view renderers; Report engine; Dashboard BI features (filters, measures, conditional formatting)
4. **🔮 P3: Ecosystem & Future** — Plugin marketplace, community growth, cloud features (deferred)

> 📄 Companion documents:
> - [ROADMAP_SPEC.md](./ROADMAP_SPEC.md) — Per-package spec compliance evaluation
> - [ROADMAP_CONSOLE.md](./ROADMAP_CONSOLE.md) — Console development roadmap
> - [ROADMAP_DESIGNER.md](./ROADMAP_DESIGNER.md) — Designer UX analysis and improvement plan
> - [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — Client SDK evaluation (100% protocol coverage)

---

## ✅ Completed Milestones (Consolidated)

Everything below has been built, tested, and verified. These items are stable and shipping.

### Foundation & Infrastructure ✅

- **Architecture:** Clean 3-layer separation (spec → types → core/react → components/plugins). 35 packages, 91+ components, 36+ field widgets.
- **Accessibility:** AriaProps injection, WCAG 2.1 AA audit (axe-core), focus management, keyboard navigation, reduced-motion support.
- **I18n:** 11 languages (ar, de, en, es, fr, ja, ko, pt, ru, zh + RTL), plural rules, locale-aware formatting, I18nLabel on all schema fields, 100% Console i18n coverage.
- **Testing:** 4,752+ tests, 90%+ coverage, E2E (Playwright), visual regression (Storybook snapshots), 200+ test files.
- **DX:** Zero-friction onboarding (<5 min), 37/37 package READMEs, all hooks JSDoc'd, error code system (`OBJUI-001`+), CLI oclif plugin (15 commands), `OBJECTUI_DEBUG` mode.
- **Documentation:** 134 docs pages, Getting Started / CRUD / Plugin / Theming guides, API reference from TypeScript, interactive schema playground, Storybook as living docs.

### Interactive Experience ✅

- **DnD:** DndProvider + useDnd across Kanban, Dashboard, Calendar, Grid, Sidebar.
- **Gestures & Touch:** Swipe, pinch, long-press via useSpecGesture; pull-to-refresh; haptic feedback.
- **Animation:** 7 presets, reduced-motion aware, page transitions (9 types with View Transitions API).
- **Notifications:** Toast/banner/snackbar with full CRUD integration.
- **View Enhancements:** Gallery, column summary, grouping, row color, density modes, view sharing, ViewTabBar (reorder, pin, context menu, type-switch, personal/shared grouping).

### Enterprise Features ✅

- **Offline:** Detection, sync queue, conflict resolution, auto-sync, IndexedDB persistence, ETag caching.
- **Collaboration:** Live cursors, presence, comment threads, conflict resolution (@object-ui/collaboration).
- **Performance:** Web Vitals tracking, performance budgets, virtual scrolling, 10K-record benchmarks.
- **Console v1.0 Build:** 48.5 KB gzip main entry, 17 granular chunks, Gzip + Brotli, CSP headers, performance budget CI.

### Designer ✅

All 4 phases across 5 designers (Page, View, DataModel, Process, Report): drag-and-drop, undo/redo, property editors, canvas pan/zoom, auto-layout, multi-select, real-time collaboration, version history.

### Component & Plugin Excellence ✅

91+ components audited for API consistency, TypeScript types with JSDoc, standardized error/empty/loading states, 36+ field widgets polished, all 13+ view types verified, 78 Storybook stories with interactive controls.

### Mobile UX Implementation ✅

All 11 plugin views (Grid, Kanban, Form, Dashboard, Calendar, Timeline, List, Detail, Charts, Map, Gantt) have responsive mobile-first layouts with touch targets ≥ 44px, responsive typography, overflow handling, and mobile-specific interactions. Console pages (AppHeader, AppSidebar, Dashboard, RecordDetail, Create/Edit Dialogs) are responsive. Core primitives (DataTable, Form Renderer, Navigation) support mobile. Infrastructure (touch/gesture system, PWA support, viewport handling, progressive loading) is complete.

### v3.0.0 Spec Integration ✅

Full adoption of Cloud namespace, contracts/integration/security/studio modules, v3.0.0 PaginatedResult API, ObjectStackAdapter metadata API, 17 compatibility tests, 70+ spec UI types re-exported.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: @objectstack/spec v3.0.8 (The Protocol)                  │
│  Pure TypeScript type definitions — 12 export modules               │
│  ❌ No runtime code. No React. No dependencies.                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ imports (never redefines)
┌──────────────────────────────▼──────────────────────────────────────┐
│  Layer 2: @object-ui/types (The Bridge)                             │
│  Re-exports spec types + ObjectUI-specific schemas                  │
│  ❌ No runtime code. Zero dependencies.                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ consumed by
┌──────────────────────────────▼──────────────────────────────────────┐
│  Layer 3: Implementations (The Runtime)                             │
│  core (Registry, Expressions, Validation, Actions)                  │
│  react (SchemaRenderer, Hooks, Providers)                           │
│  components (91+ Shadcn-based renderers)                            │
│  fields (35+ field widgets)                                         │
│  layout (AppShell, Page, SidebarNav)                                │
│  plugin-* (Grid, Kanban, Calendar, Charts, etc.)                   │
│  auth / tenant / permissions / i18n (Infrastructure)                │
│  data-objectstack (ObjectStackAdapter)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Protocol Consistency Assessment (February 2026)

> A comprehensive comparison of `@objectstack/spec` (Protocol) vs `@object-ui/*` (Renderer), assessing how well ObjectUI can render full enterprise interfaces from spec JSON metadata.

### Summary Scorecard

| Protocol Area | Spec Coverage | ObjectUI Coverage | Gap |
|:---|:---|:---|:---|
| **Atom Components** (Button, Input, Badge, etc.) | N/A | ✅ 50+ Shadcn components | ✅ |
| **Layout Primitives** (Flex, Grid, Card, Tabs) | N/A | ✅ Complete | ✅ |
| **App Shell / Navigation** | ✅ Complete (7 nav types, areas, mobile) | 🔴 0% | 🔴 |
| **List View** (Grid/Kanban/Calendar/Gantt/Gallery/Timeline/Map) | ✅ Complete | ⚠️ ~30% (data-table, kanban, calendar exist but not spec-aligned) | 🟡 |
| **Form View** (simple/tabbed/wizard/split/drawer/modal) | ✅ Complete | ⚠️ ~20% (basic FormSchema only) | 🟡 |
| **Page Composition** | ✅ Complete (16 types, regions, variables, blank layout) | ⚠️ ~25% (regions aligned, missing page types/components) | 🟡 |
| **Dashboard** | ✅ Complete (data-binding, filters, measures) | ⚠️ ~15% (grid layout only) | 🟡 |
| **Action Protocol** | ✅ Complete | 🔴 0% | 🔴 |
| **Report** | ✅ Complete | 🔴 0% | 🔴 |
| **Data Binding Bridge** | ✅ `ViewDataSchema`, `ElementDataSourceSchema` | 🔴 0% | 🔴 |
| **Expression Engine** | ✅ Referenced in `visible`/`disabled`/`events` | 🔴 0% (static booleans only) | 🔴 |
| **i18n / ARIA** | ✅ On every schema | 🔴 0% | 🔴 |

**Overall Protocol Alignment: ~20%**

### What CAN Be Built Today

1. **Static component demos** — Buttons, Inputs, Cards, Tables with hardcoded data
2. **Basic page layouts** — Using Flex/Grid/Container/Tabs
3. **Storybook component library** — Isolated Shadcn primitives

### What CANNOT Be Built Today

1. **App Shell with dynamic navigation** — No AppSchema renderer, no sidebar from JSON
2. **Metadata-driven List Views** — No bridge from spec field bindings to rendered DataTable
3. **Metadata-driven Forms** — No bridge from `FormViewSchema` sections to rendered form fields
4. **Dashboard with data binding** — Widgets can't auto-query objects by `categoryField`/`valueField`
5. **Action execution** — No way to interpret `{ type: 'script', target: 'approve_contract' }`
6. **Record pages** — No `record:details`, `record:related_list`, `record:activity` components
7. **Expression evaluation** — No `visible: "${data.role === 'admin'}"` support
8. **Report rendering** — No report engine
9. **Real-time filtering / search** — No quick filters, searchable fields, or global dashboard filters

### Codebase Statistics

| Area | Count | Notes |
|------|-------|-------|
| Packages | 35 | 37 with README (100%) |
| Components | 91+ | 48 base UI + 14 custom + 29 renderers |
| Field Widgets | 36+ | Consistent FieldWidgetProps pattern |
| Test Files | 200+ | 4,752+ tests, 90%+ coverage |
| Storybook Stories | 78 | All components covered |
| CLI Commands | 15 | oclif plugin architecture |
| I18n Locales | 11 | ar, de, en, es, fr, ja, ko, pt, ru, zh + RTL |
| CI Workflows | 13 | CI, CodeQL, Storybook, perf budget, etc. |

---

## 🎯 Current Priorities

> Priorities reorganized (Feb 20, 2026) based on the **Protocol Consistency Assessment**. The assessment revealed ~20% overall alignment with `@objectstack/spec`. Component-level UI (atoms, layout, mobile) is ✅ complete. The critical gap is the **protocol bridge layer** — the infrastructure that transforms spec JSON metadata into rendered UI. This is now the #1 priority.

### P0. SpecBridge & Core Protocol Infrastructure — Must Ship 🎯

**Goal:** Build the foundational bridge layers that enable ObjectUI to render a Console from `@objectstack/spec` JSON metadata. Without these, no metadata-driven application can be built.

#### P0.1 SpecBridge — `@object-ui/react`
- [ ] Build `SpecBridge` module — transforms `@objectstack/spec` View/Page/App JSON → ObjectUI `SchemaNode` tree
- [ ] Implement `ListViewSchema` → `DataTableSchema` bridge (field → column mapping, data provider resolution)
- [ ] Implement `FormViewSchema` → `FormSchema` bridge (sections, columns, widget overrides)
- [ ] Implement `PageSchema` → ObjectUI page composition bridge (16 page types → renderer tree)
- [ ] Implement `DashboardSchema` → dashboard widget bridge (data binding, filter resolution)

#### P0.2 AppShell & Navigation Renderer
- [ ] Implement `AppSchema` renderer consuming spec JSON (name, label, icon, branding)
- [ ] Build navigation tree renderer (7 nav item types: object, dashboard, page, url, report, action, group)
- [ ] Implement `NavigationAreaSchema` support (business domain partitioning)
- [ ] Implement mobile navigation modes (drawer/bottom_nav/hamburger)
- [ ] Add permission guards (`requiredPermissions`, `visible`) on navigation items

#### P0.3 Expression Engine — `@object-ui/core`
- [ ] Implement expression string evaluation for `visible` / `disabled` / `events` (e.g., `"${data.age > 18}"`)
- [ ] Support data context binding in expressions (row data, page variables, user context)
- [ ] Integrate expression evaluation into SchemaRenderer pipeline

#### P0.4 Action Runtime — `@object-ui/core`
- [ ] Implement `ActionSchema` interpreter (5 types: script, url, modal, flow, api)
- [ ] Implement declarative `ActionEngine` pipeline (events → `ActionDef[]` dispatch) — replaces callback-based `useObjectActions`
- [ ] Support action locations (list_toolbar, list_item, record_header, record_more, global_nav)
- [ ] Implement confirmation dialog (`confirmText`), keyboard shortcuts, bulk operations, `refreshAfter`

#### P0.5 Data Binding Layer
- [ ] Implement `ViewDataSchema` discriminated union (object/api/value data providers)
- [ ] Build `ElementDataSourceSchema` binding for component-level data resolution
- [ ] Connect data providers to existing `ObjectStackAdapter` for server communication

#### P0.6 Console Core UI (Remaining)
- [x] Migrate Console from static config to runtime metadata API (`getView()`/`getApp()`/`getPage()`)
- [x] CSV/Excel export for grid views
- [x] File upload fields in forms
- [x] Related record lookup in forms

### P1. Spec Protocol Alignment — UI-Facing 📐

**Goal:** Align all existing view plugins and components with `@objectstack/spec` contracts. Close the gap between ObjectUI's data-driven approach and spec's metadata-driven approach.

#### P1.1 ListView Spec Alignment
- [ ] Align `ListColumnSchema` shape (field, width, align, pinned, summary, link, action) with spec — currently uses TanStack-style `accessorKey`
- [ ] Implement `rowHeight`, `grouping`, `rowColor` spec properties
- [ ] Implement row/bulk actions (`rowActions`, `bulkActions`)
- [ ] Implement conditional formatting
- [ ] Implement inline edit spec property
- [ ] Implement export, virtual scroll spec properties
- [ ] Implement empty state spec property
- [ ] Implement selection and pagination spec alignment
- [x] Implement `quickFilters` and `userFilters` spec properties
- [x] Implement `hiddenFields` and `fieldOrder` spec properties
- [x] Implement `emptyState` spec property

#### P1.2 FormView Spec Alignment
- [ ] Implement form layout types: tabbed, wizard, split, drawer, modal (currently flat form only)
- [ ] Implement `FormSectionSchema` with 1-4 column layout
- [ ] Implement `FormFieldSchema` properties: widget override, `dependsOn`, `visibleOn`, `colSpan`

#### P1.3 Dashboard Spec Alignment
- [ ] Implement widget data binding (object, filter, `categoryField`, `valueField`, aggregate)
- [ ] Implement `GlobalFilterSchema` with dynamic `optionsFrom`
- [ ] Implement date range filter (14 presets + custom)
- [ ] Implement `DashboardHeaderSchema` (actions, show/hide title)
- [ ] Implement widget color variants (8 spec variants)
- [ ] Implement multi-measure (pivot/matrix) via `WidgetMeasureSchema`

#### P1.4 Page Composition Spec Alignment
- [ ] Expand page types from 4 → 16 (add grid, list, gallery, kanban, calendar, timeline, form, record_detail, record_review, overview, dashboard, blank)
- [ ] Implement `PageComponentType` enum (30+ namespaced component types)
- [ ] Implement event handlers (expression-based actions on page components)
- [ ] Implement blank page layout (grid canvas)
- [ ] Implement responsive config per-component
- [ ] Add `record_id` to `PageVariable` types (minor gap)

#### P1.5 Record Components
- [ ] Build `record:details` component
- [ ] Build `record:related_list` component
- [ ] Build `record:highlights` component
- [ ] Build `record:activity` component (spec-aligned, replaces loose TimelineSchema)
- [ ] Build `record:chatter` component
- [ ] Build `record:path` component

#### P1.6 i18n & ARIA Protocol Alignment
- [ ] Support `I18nLabelSchema` (string | { en, zh, ... }) across all component `label` props
- [ ] Add `AriaPropsSchema` support to all renderable schemas
- [ ] Integrate i18n label resolution into SpecBridge pipeline

#### P1.7 View Enhancement Properties (Completed Subset)
- [x] Implement `rowHeight` → density mode (compact/medium/tall)
- [x] Implement `DensityMode` support for grid and list views
- [x] Implement `conditionalFormatting` type definition and evaluation function
- [x] Implement `inlineEdit` → `editable` property on grid child view
- [x] Implement `exportOptions` (csv, xlsx, json, pdf)
- [x] Implement `aria` and `sharing` spec properties on ListView
- [x] PivotTable component (`plugin-dashboard`)
- [x] ViewTabBar with full tab management UX (reorder, pin, context menu, type-switch, grouping)
- [x] TimelineConfig spec alignment (`startDateField`, `endDateField`, `groupByField`, `colorField`, `scale`)
- [x] GalleryConfig type and export
- [x] Navigation property support across all view plugins

### P2. Advanced Views & Features 🧩

**Goal:** Build remaining view renderers and advanced features from the spec.

#### P2.1 Missing View Renderers
- [ ] Gallery view renderer (spec-aligned)
- [ ] Timeline view renderer (spec-aligned, advanced features beyond basic)
- [ ] Gantt view renderer — inline task editing, marker clustering
- [ ] Map view renderer — Supercluster for 100+ markers
- [ ] Combo chart support (bar + line overlay)

#### P2.2 Report Engine
- [ ] Build report renderer from `report.zod.ts` spec
- [ ] Support report data binding, sections, and chart integration

#### P2.3 Spec Protocols — Advanced
- [ ] Implement `theme.zod.ts` spec integration (beyond current ThemeEngine)
- [ ] Implement `dnd.zod.ts` spec protocol (spec-aligned drag-and-drop config)
- [ ] Implement `keyboard.zod.ts` spec protocol (declarative keyboard shortcuts)
- [ ] Implement `notification.zod.ts` spec alignment (ToastSchema exists, needs spec shape)
- [ ] Implement `responsive.zod.ts` spec protocol (per-component responsive config)
- [ ] Implement `sharing.zod.ts` and `SharingConfigSchema` / `EmbedConfigSchema`

#### P2.4 Dashboard BI Features
- [ ] Dashboard performance and responsive config
- [ ] Dashboard auto-refresh with `refreshInterval`
- [ ] Widget measure and pivot support
- [ ] Airtable-parity features (userActions, appearance, tabs, addRecord, showRecordCount)

#### P2.5 Remaining Plugin Polish
- [ ] Column reorder/resize persistence for grid
- [ ] Drag-to-reschedule calendar events
- [ ] Marker clustering for map plugin

### P3. Mobile Testing & Quality Assurance 📱

> ✅ **Mobile implementation is largely complete** (P6.1-P6.4 done). Only testing and QA remain.

- [x] Playwright mobile viewport tests (iPhone SE 375px, iPhone 14 390px, iPad 768px)
- [ ] Visual regression tests for all views at mobile breakpoints
- [ ] Touch interaction tests (swipe, pinch, long-press) via Playwright touch emulation
- [ ] axe-core audit at mobile viewport sizes
- [ ] Storybook mobile viewport decorator for all component stories
- [ ] On-screen keyboard interaction tests for all form fields
- [ ] Performance benchmark on simulated mobile CPU (4× slowdown) and 3G network

---

## 🔮 Future Vision (Deferred)

> The following items are **not** in the current sprint. They will be re-evaluated once P0–P2 (SpecBridge, protocol alignment, and advanced views) are complete.

### Ecosystem & Marketplace
- Plugin marketplace website with search, ratings, and install count
- Plugin publishing CLI (`os ui publish`) with automated validation
- 25+ official plugins
- Plugin contract enforcement via contracts module

### Community Growth
- Official website (www.objectui.org) with interactive playground
- Discord community
- Monthly webinars, technical blog, YouTube tutorials
- Conference talks and contributor program

### ObjectUI Cloud (2027)
- Project hosting, online editor, Database as a Service
- One-click deployment, performance monitoring
- Billing system (Free / Pro / Enterprise)

### Industry Solutions (2027)
- CRM, ERP, HRM, E-commerce, Project Management accelerators
- Technology & channel partnerships
- AI-powered schema generation from natural language

---

## 📈 Success Metrics

### v1.0 Release Criteria (P0)

| Metric | Current | v1.0 Target | How Measured |
|--------|---------|-------------|--------------|
| **Protocol Alignment** | ~20% | 80%+ (UI-facing) | Protocol Consistency Assessment |
| **SpecBridge** | Not started | View/Page/App/Dashboard bridges working | Integration tests |
| **Expression Engine** | Static booleans only | Dynamic `visible`/`disabled`/`events` evaluation | Unit tests + Console demo |
| **Action Runtime** | Callback-based | `ActionSchema` interpreter (5 types) | ActionEngine integration test |
| **AppShell Renderer** | No spec renderer | Sidebar + nav tree from `AppSchema` JSON | Console renders from spec JSON |
| **Data Binding** | Raw `data[]` props | `ViewDataSchema` → ObjectStackAdapter | Data-driven view rendering |
| **Build Status** | 42/42 pass | 42/42 pass | `pnpm build` |

### Quality Metrics (Ongoing)

| Metric | Current (Feb 2026) | Target | How Measured |
|--------|--------------------|--------------------|--------------|
| **Test Coverage** | 90%+ | 90%+ | `pnpm test:coverage` |
| **Test Count** | 4,752+ | 5,000+ | `pnpm test` summary |
| **Storybook Stories** | 78 | 91+ (1 per component) | Story file count |
| **Package READMEs** | 37/37 (100%) | 37/37 (100%) | README.md presence |
| **Console i18n Coverage** | 100% | 100% | No hardcoded strings |
| **WCAG AA Compliance** | Full Console pages | Full Console pages | axe-core audit |

### DX Success Criteria ✅
- [x] New developer can `git clone` → `pnpm install` → `pnpm dev` → see Console in < 5 minutes
- [x] `objectui init my-app` creates a buildable project with zero errors
- [x] Every exported function/hook/type has JSDoc with at least one usage example
- [x] Invalid schema input produces an error message with fix suggestion and docs link

### UX Success Criteria ✅
- [x] Console loads in < 2s on simulated 3G connection
- [x] All Console UI strings are internationalized (0 hardcoded strings)
- [x] Grid view handles 10,000+ records without jank (< 100ms interaction latency)
- [x] Full keyboard navigation for all Console workflows (no mouse required)

---

## ⚠️ Risk Management

| Risk | Mitigation |
|------|------------|
| **SpecBridge complexity** | Start with ListView bridge (highest value), iterate to Form/Page/Dashboard; integration tests at each step |
| **Protocol alignment vs shipping** | P0 focuses on bridge infrastructure; full alignment (i18n/ARIA/all page types) deferred to P1 |
| **Spec changes (post v3.0.8)** | Strict "import, never redefine" rule; type updates propagate automatically |
| **Performance regression** | Performance budgets in CI, PerformanceConfigSchema monitoring, 10K-record benchmarks |
| **i18n regression (new hardcoded strings)** | ESLint rule to detect string literals in JSX; i18n coverage metric in CI |
| **Component API inconsistency** | Audit checklist, automated prop-type validation, Storybook as source of truth |
| **Accessibility regression** | axe-core tests on full Console pages (not just primitives), WCAG AA CI check |
| **Mobile responsiveness regression** | Playwright mobile viewport tests, Lighthouse CI mobile preset, touch target audit |

---

## 📚 Reference Documents

- [ROADMAP_SPEC.md](./ROADMAP_SPEC.md) — Per-package @objectstack/spec compliance evaluation
- [ROADMAP_CONSOLE.md](./ROADMAP_CONSOLE.md) — Console development roadmap with phase-by-phase progress
- [ROADMAP_DESIGNER.md](./ROADMAP_DESIGNER.md) — Designer UX analysis and improvement plan
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Developer quick reference

---

## 🎯 Getting Involved

### For Contributors
- Review [CONTRIBUTING.md](./CONTRIBUTING.md)
- Check [Good First Issues](https://github.com/objectstack-ai/objectui/labels/good%20first%20issue)

### For Plugin Developers
- Read [Plugin Development Guide](./content/docs/guide/plugin-development.mdx)

---

**Roadmap Status:** 🎯 Active — SpecBridge · Protocol Alignment · Action Engine · Expression Engine
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
