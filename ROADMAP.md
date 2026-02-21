# ObjectUI Development Roadmap

> **Last Updated:** February 21, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.8
> **Client Version:** @objectstack/client v3.0.8
> **Target UX Benchmark:** 🎯 Airtable parity
> **Current Priority:** AppShell Navigation · Designer Interaction · Dashboard Config Panel · Airtable UX Polish

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** Foundation is **solid and shipping** — 35 packages, 91+ components, 5,100+ tests, 78 Storybook stories, 42/42 builds passing, ~85% protocol alignment. SpecBridge, Expression Engine, Action Engine, data binding, all view plugins (Grid/Kanban/Calendar/Gantt/Timeline/Map/Gallery), Record components, Report engine, Dashboard BI features, mobile UX, i18n (11 locales), WCAG AA accessibility, Designer Phase 1 (ViewDesigner drag-to-reorder ✅), Console through Phase 20 (L3), and **AppShell Navigation Renderer** (P0.1) — all ✅ complete.

**What Remains:** The gap to **Airtable-level UX** is primarily in:
1. ~~**AppShell** — No dynamic navigation renderer from spec JSON (last P0 blocker)~~ ✅ Complete
2. **Designer Interaction** — ViewDesigner and DataModelDesigner have undo/redo, field type selectors, inline editing, Ctrl+S save, column drag-to-reorder with dnd-kit ✅
3. **Dashboard Config Panel** — Airtable-style right-side configuration panel for dashboards (data source, layout, widget properties, sub-editors, type definitions)
4. **Console Advanced Polish** — Remaining upgrades for forms, import/export, automation, comments
5. **PWA Sync** — Background sync is simulated only

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

- [ ] Excel (XLSX) export with formatting
- [ ] PDF export with custom formatting
- [ ] Export all data (not just visible rows)
- [ ] Custom column selection for export
- [ ] Scheduled exports via automation
- [ ] Export templates with custom formatting
- [ ] Import field mapping UI (map CSV columns to object fields)
- [ ] Import validation preview with error correction
- [ ] Duplicate detection during import

### P1.4 Console — Undo/Redo & History

- [ ] Cross-session undo stack persistence (survive page refresh)
- [ ] Undo grouping (batch multiple field changes as one undo step)
- [ ] Visual undo history panel (timeline of changes)
- [ ] Undo/redo for bulk operations

### P1.5 Console — Comments & Collaboration

- [ ] @mention notification delivery (email/push)
- [ ] Comment search across all records
- [ ] Comment pinning/starring
- [ ] Activity feed filtering (comments only / field changes only)

### P1.6 Console — Automation

- [ ] Multi-step automation builder (if-then chains)
- [ ] Scheduled automations (cron-based triggers)
- [ ] Webhook triggers and actions
- [ ] Email notification actions
- [ ] Automation execution history and logs

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
- [ ] Conditional formatting rules

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

### P2.1 Designer — Remaining Interaction (Post-v1.0)

- [ ] PageDesigner: Component drag-to-reorder and drag-to-position
- [ ] ProcessDesigner: Node drag-to-move
- [ ] ReportDesigner: Element drag-to-reposition within sections
- [ ] Edge creation UI in ProcessDesigner (click source → click target)
- [ ] Property editing for node labels/types in ProcessDesigner
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
- [ ] `@object-ui/plugin-workflow`: React Flow integration for production canvas
- [ ] `@object-ui/plugin-ai`: Configurable AI endpoint adapter (OpenAI, Anthropic)
- [ ] Navigation `width` property: apply to drawer/modal overlays across all plugins
- [ ] Navigation `view` property: specify target form/view on record click across all plugins

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

---

## 📚 Reference

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Developer quick reference
- [Plugin Development Guide](./content/docs/guide/plugin-development.mdx)

---

**Roadmap Status:** 🎯 Active — AppShell · Designer Interaction · Dashboard Config Panel · Airtable UX Parity
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
