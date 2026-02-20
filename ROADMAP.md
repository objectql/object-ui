# ObjectUI Development Roadmap

> **Last Updated:** February 19, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.7
> **Client Version:** @objectstack/client v3.0.7
> **Current Priority:** 🎯 v1.0 UI Essentials · Spec Compliance · Component Excellence · Developer Experience · Mobile UX

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** The foundation is solid — 35 packages, 91+ components, 200+ test files, 68 Storybook stories, 98% spec compliance, and all 42 builds passing. The @objectstack/spec v3.0.0 migration is complete, and the Console v1.0 production build is optimized and shipping.

**What's Next:** Priorities have been reorganized (Feb 16, 2026) to focus on **v1.0 release UI essentials** — the minimum viable set of UI features and spec compliance required for a usable first release. Non-UI infrastructure, marketplace, and cloud features are deferred until after v1.0 ships. The re-prioritized focus is:

1. **🎯 v1.0 UI Essentials** — Core UI functionality required for a usable first release: spec-compliant views, working navigation, CRUD flows, and Console completeness
2. **📐 Spec Compliance (UI-Facing)** — Align all view plugins with @objectstack/spec contracts: TimelineConfig, GalleryConfig, navigation properties, ListView spec properties
3. **🧩 Component & Plugin Excellence** — Polish every view plugin for production use: empty states, error handling, edge cases, toolbar consistency
4. **🛠️ Developer Experience (DX)** — Zero-friction onboarding, discoverable APIs, helpful errors, complete docs (✅ largely complete)
5. **📱 Mobile User Experience** — Responsive layouts, touch-friendly interactions, PWA support (✅ largely complete, testing remaining)

> 📄 Companion documents:
> - [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) — Per-package spec compliance (98% current)
> - [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — Client SDK evaluation (100% protocol coverage)
> - [DESIGNER_UX_ANALYSIS.md](./DESIGNER_UX_ANALYSIS.md) — Designer UX improvement plan

---

## ✅ Completed Milestones

Everything below has been built, tested, and verified. These items are stable and shipping.

### Foundation (Q1 2026)

Accessibility (AriaProps injection, WCAG 2.1 AA audit with axe-core), responsive design (breakpoint-aware layouts), I18n deep integration (10 languages, RTL, plural rules, locale-aware formatting), I18nLabel handling across all schema fields, 80%+ test coverage with E2E (Playwright) and visual regression (Storybook snapshots), and critical bug fixes (DataScope, plugin-ai handlers, plugin-detail data fetching, plugin-map error handling).

### Interactive Experience (Q2 2026)

Drag-and-drop framework (DndProvider + useDnd for Kanban, Dashboard, Calendar, Grid, Sidebar), gesture & touch support (swipe, pinch, long-press via useSpecGesture), focus management & keyboard navigation (focus traps, keyboard shortcuts, CRUD shortcuts), animation & motion system (7 presets, reduced-motion aware), notification system (toast/banner/snackbar with full CRUD), view enhancements (gallery, column summary, grouping, row color, density modes, view sharing), Console UX (skeleton loading, toast notifications, responsive sidebar, onboarding walkthrough, global search, favorites), and Designer Phase 1 (ARIA attributes, keyboard shortcuts, empty states, zoom controls across all 5 designers).

### Enterprise & Offline (Q3 2026)

Offline-first architecture (offline detection, sync queue, conflict resolution, auto-sync, IndexedDB persistence, ETag caching), real-time collaboration (@object-ui/collaboration with live cursors, presence, comment threads, conflict resolution), performance optimization (Web Vitals tracking, performance budgets, performance dashboard), and page transitions (9 transition types with View Transitions API support).

### Console v1.0 Production Release

Bundle optimization (main entry 48.5 KB gzip, 17 granular chunks, 95% reduction from monolithic build), Gzip + Brotli pre-compression, MSW lazy-loading with full exclusion in server mode, bundle analysis tooling, and production hardening (CSP headers, modulepreload hints, cache documentation, error tracking guide, performance budget CI).

### v3.0.0 Deep Integration

Full adoption of Cloud namespace, contracts/integration/security/studio modules, v3.0.0 PaginatedResult API (records/total/hasMore), updated ObjectStackAdapter metadata API, and 17 compatibility tests.

### Designer Completion

All 4 phases complete across 5 designers (Page, View, DataModel, Process, Report): drag-and-drop positioning, undo/redo with command pattern, confirmation dialogs, edge creation UI, inline editing, full property editors with live preview, canvas pan/zoom with minimap, auto-layout algorithms, copy/paste, multi-select, responsive panels, real-time collaboration integration, live cursors, synchronized undo/redo, and version history.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: @objectstack/spec v3.0.0 (The Protocol)                  │
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

## 📊 Full-Repository Audit (February 2026)

> A comprehensive scan of the entire codebase and documentation, analyzed from both **Developer Experience (DX)** and **User Experience (UX)** perspectives.

### Audit Scope

| Area | Count | Notes |
|------|-------|-------|
| Packages | 35 | 37 with README (100%) |
| Components | 91+ | 48 base UI + 14 custom + 29 renderers |
| Field Widgets | 36+ | Consistent FieldWidgetProps pattern |
| Storybook Stories | 68 | Good coverage, some gaps in edge-case stories |
| Documentation Pages | 134 | .mdx/.md files across 8 categories |
| Test Files | 200+ | 3,235+ tests, 80% coverage |
| Examples | 4 | todo, crm, kitchen-sink, msw-todo |
| CLI Commands | 15 | init, build, dev, serve, doctor, etc. (oclif plugin) |
| I18n Locales | 11 | ar, de, en, es, fr, ja, ko, pt, ru, zh + RTL |
| CI Workflows | 13 | CI, CodeQL, Storybook, perf budget, etc. |

### Key Findings

**Strengths:**
- Solid architecture with clear layer separation (spec → types → core → react → components)
- Excellent quick-start guide (`content/docs/guide/quick-start.md`, 197 lines)
- Clean app bootstrapping (`apps/console/src/main.tsx`, 44 lines, well-commented)
- 15 CLI commands with `doctor` for environment diagnosis (oclif plugin architecture)
- Per-component error boundaries with retry (SchemaErrorBoundary)
- 13 CI/CD workflows including performance budgets and visual regression

**Gaps Identified:**
- ~~10 packages missing README~~ ✅ All 37 packages now have READMEs
- ~~20+ React hooks exported without JSDoc documentation~~ ✅ All hooks documented with JSDoc
- ~~Console has hardcoded English strings outside i18n~~ ✅ All strings migrated to i18n keys
- ~~MIGRATION_GUIDE.md referenced in README but does not exist~~ ✅ Created
- ~~Types package has minimal JSDoc on exported interfaces~~ ✅ All field widgets and components now have JSDoc
- ~~No interactive schema playground in documentation site~~ ✅ Schema playground guide added to docs
- ~~Core error messages lack error codes and actionable fix suggestions~~ ✅ Error code system implemented

---

## 🎯 Current Priorities

> Priorities re-ordered (Feb 16, 2026) to focus on **v1.0 UI essentials first**. All foundation DX/UX work is complete. The new priority order puts UI-facing functionality and spec compliance ahead of infrastructure and non-UI tasks, ensuring the first release delivers a usable, spec-compliant product.

### P0. v1.0 UI Essentials — Must Ship 🎯

**Goal:** Every core UI workflow works end-to-end in the Console: CRUD, views, navigation, dashboards, and reports. These are the minimum features required for v1.0 to be usable.

#### P0.1 Console Core UI Completeness
- [ ] Implement declarative `ActionEngine` pipeline (events → `ActionDef[]` dispatch) — replaces callback-based `useObjectActions`
- [x] Migrate Console from static config to runtime metadata API (`getView()`/`getApp()`/`getPage()`)
- [x] Remove `as any` cast in `objectstack.shared.ts` — use properly typed config
- [x] Remove `as any` cast in `examples/crm/objectstack.config.ts` — enforce `defineStack` type safety
- [x] Clean up MSW workarounds in `objectstack.config.ts`
- [x] CSV/Excel export for grid views (core data workflow)
- [x] File upload fields in forms (required for real-world data entry)
- [x] Related record lookup in forms (essential for relational data)

#### P0.2 View Plugin Navigation Compliance
- [x] Add navigation property support to ObjectGallery (currently only accepts `onCardClick`)
- [x] Apply `navigation.width` to drawer/modal overlays in Kanban, Calendar, Gantt, Timeline, Map, View plugins
- [x] Implement `navigation.view` property across all view plugins — `NavigationOverlay` supports `renderView` prop for view-specific rendering

#### P0.3 Spec-Compliant View Configs
- [x] Define `TimelineConfig` type in `@object-ui/types` aligned with `@objectstack/spec TimelineConfigSchema`
- [x] Rename Timeline `dateField` → `startDateField` to match spec naming convention
- [x] Export `GalleryConfig` type from `@object-ui/types` index.ts
- [x] Implement Timeline spec properties: `endDateField`, `groupByField`, `colorField`, `scale`

#### P0.4 ListView Spec Properties (v1.0 Subset)
- [x] Implement `emptyState` spec property (custom no-data UI — critical for UX)
- [x] Implement `hiddenFields` and `fieldOrder` spec properties (view customization)
- [x] Implement `quickFilters` spec property (predefined filter buttons)
- [x] Implement `userFilters` spec property — Airtable Interfaces-style user filters (dropdown / tabs / toggle modes)

### P1. Spec Compliance — UI-Facing 📐

**Goal:** Achieve 100% compliance with `@objectstack/spec` for all UI-facing contracts. These items improve user experience and ensure protocol compatibility.

#### P1.1 View Enhancement Properties
- [x] Implement `rowHeight` spec property in ListView — maps to density mode (compact/medium/tall)
- [x] Add `DensityMode` support to grid and list views
- [x] Implement `conditionalFormatting` spec property in ListView — type definition and evaluation function
- [x] Implement `inlineEdit` spec property in ListView — passed as `editable` to grid child view

#### P1.2 Data Export & Import
- [x] Implement `exportOptions` spec property in ListView (csv, xlsx, json, pdf)
- [x] Add `aria` spec property support to ListView — label, describedBy, live attributes
- [x] Add `sharing` spec property support to ListView — Share button in toolbar with visibility level

#### P1.3 Advanced View Features
- [x] PivotTable component (`plugin-dashboard`) — cross-tabulation with sum/count/avg/min/max, row/column totals, format, columnColors
- [ ] Inline task editing for Gantt chart
- [ ] Marker clustering for map plugin (Supercluster for 100+ markers)
- [ ] Combo chart support (e.g., bar + line overlay)
- [ ] Column reorder/resize persistence for grid
- [ ] Drag-to-reschedule calendar events (move between dates)

#### P1.4 View Tab Management UX (Airtable/Salesforce-style)
- [x] `ViewTabBarConfig` type in `@object-ui/types` — configures tab bar UX (showAddButton, contextMenu, overflow, indicators)
- [x] `ViewTabBar` reusable component in `plugin-view` — extracted from console inline tabs
- [x] Inline "+" Add View button on tab bar (configurable via `showAddButton`)
- [x] Right-click context menu on view tabs: Rename, Duplicate, Delete, Set as Default, Share
- [x] Tab overflow → "More" dropdown when `maxVisibleTabs` exceeded
- [x] Filter/sort indicator badge (dot) on view tabs (`showIndicators`)
- [x] "Save as View" indicator + button when user has unsaved filter/sort changes
- [x] Double-click inline rename on view tabs (`inlineRename`)
- [x] Drag-reorder view tabs (`reorderable` — needs `@dnd-kit/sortable`)
- [x] Pin/favorite views
- [x] View type quick-switch palette (Notion-style layout menu)
- [x] Personal vs. shared views grouping in tab bar

### P2. Component & Plugin Excellence 🧩 (Completed Foundation)

**Goal:** Every component is polished, consistent, well-tested, and delightful to use.

> ✅ **Foundation complete** — P2 items from the Feb 2026 audit are all resolved. The subsections below document the completed work.

#### P2.1 Component Quality Audit ✅
- [x] Audit all 91+ components for API consistency (prop naming, default values, error states)
- [x] Ensure every component has complete TypeScript types with JSDoc descriptions
- [x] Standardize error/empty/loading states across all components
- [x] Add missing edge-case handling (overflow, truncation, null data, large datasets)

#### P2.2 Field Widget Polish ✅
- [x] Audit all 36+ field widgets for consistent validation feedback
- [x] Ensure all fields work correctly in all form variants
- [x] Test field widgets with extreme inputs
- [x] Polish date/time/datetime pickers for timezone edge cases

#### P2.3 Plugin View Robustness ✅
- [x] Verify all 13+ view types handle empty data, loading, and error states gracefully
- [x] Ensure consistent toolbar, filter, and sort behavior across all views
- [x] Validate view switching preserves selection state, scroll position, and filter criteria
- [x] Add E2E tests for critical view workflows

#### P2.4 Test Coverage ✅
- [x] Increase test coverage from 80% → 90% (target: 4,000+ tests)
- [x] Identify and cover components with < 80% test coverage
- [x] Add integration tests for complex interactions
- [x] Add snapshot tests for critical UI output consistency

#### P2.5 Storybook Enhancement ✅
- [x] Ensure every exported component has at least one Storybook story
- [x] Add interactive controls (args) for all major props
- [x] Add "edge case" stories per component
- [x] Organize stories with consistent categorization

### P3. Developer Experience 🛠️ (Completed Foundation)

**Goal:** A developer can go from `git clone` to a running app in under 5 minutes.

> ✅ **Foundation complete** — All DX items from the Feb 2026 audit are resolved.

#### P3.1 Zero-Friction Onboarding ✅
- [x] Create MIGRATION_GUIDE.md at repo root
- [x] Streamline `npx create-objectui-app` scaffolding
- [x] Ensure `pnpm install && pnpm dev` starts the console with zero additional configuration
- [x] Add a standalone "Hello World" example
- [x] Provide copy-paste-ready schema examples in the root README

#### P3.2 API Discoverability & JSDoc ✅
- [x] Add JSDoc comments to all 20+ exported React hooks
- [x] Add JSDoc with usage examples to key types in `@object-ui/types`
- [x] Document all context providers with usage examples
- [x] Ensure TypeScript autocompletion works smoothly for all schema types

#### P3.3 Error Messages & Debugging ✅
- [x] Create error code system (`OBJUI-001`, `OBJUI-002`, etc.)
- [x] Improve SchemaErrorBoundary to show actionable fix suggestions in dev mode
- [x] Replace generic `console.warn()` calls with structured error factory
- [x] Add `OBJECTUI_DEBUG=true` mode
- [x] Ensure console warnings for deprecated APIs include migration code snippets

#### P3.4 CLI Tooling Polish ✅
- [x] Verify `objectui init` produces a buildable project
- [x] Enhance `objectui doctor` to check TypeScript version, Tailwind config, and peer dependencies
- [x] Verify `create-plugin` template produces a plugin with working tests
- [x] Add `objectui validate <schema.json>` command
- [x] Resolve TODO/FIXME items in CLI code

#### P3.5 CLI oclif Migration ✅
- [x] Refactor `@object-ui/cli` to oclif plugin `@objectstack/plugin-ui`
- [x] Migrate all 15 commands to oclif Command classes under `src/commands/ui/`
- [x] Add `@oclif/core` dependency and oclif plugin configuration
- [x] Preserve backward-compatible `objectui` bin entry
- [x] Add 55 tests for oclif command classes
- [x] Create migration documentation (`packages/cli/MIGRATION.md`)

#### P3.6 Package READMEs ✅
- [x] All 37 packages now have READMEs

### P4. User Experience 🎨 (Completed Foundation)

**Goal:** Every interaction in the Console and rendered UIs is fast, polished, accessible, and works flawlessly in all supported languages.

> ✅ **Foundation complete** — All UX items from the Feb 2026 audit are resolved.

#### P4.1 Console i18n Completeness ✅
- [x] Migrate hardcoded strings in `LoadingScreen.tsx` to i18n keys
- [x] Migrate hardcoded strings in `KeyboardShortcutsDialog.tsx` to i18n keys
- [x] Audit all `apps/console/src/components/` for remaining hardcoded UI strings
- [x] Remove all Chinese UI strings; enforce English-only with i18n key lookups
- [x] Add locale switcher to Console settings panel

#### P4.2 Console Architecture Cleanup ✅
- [x] Consolidate hand-wired ObjectView into plugin-based ObjectView
- [x] Replace lightweight local data adapter with official `@object-ui/data-objectstack`
- [x] Replace custom `defineConfig()` with standard `defineStack()`
- [x] Register all missing plugins properly in the plugin registry
- [x] Convert hardcoded view tabs to schema-driven configuration

#### P4.3 Accessibility & Inclusive Design ✅
- [x] Run axe-core audit on Console pages
- [x] Ensure focus management across all Console navigation flows
- [x] Verify screen reader experience for complex views
- [x] Test all color combinations against WCAG 2.1 AA contrast ratios
- [x] Add `prefers-reduced-motion` respect to all animations

#### P4.4 Performance at Scale ✅
- [x] Benchmark Grid/Kanban/Calendar with 1,000+ and 10,000+ records
- [x] Implement virtual scrolling for large data grids
- [x] Profile and optimize initial Console load (target: < 2s on 3G)
- [x] Add loading skeleton states for all async data views
- [x] Test view switching state preservation with large datasets

#### P4.5 Console Feature Completeness ✅
- [x] Verify CRUD end-to-end for all object types
- [x] Verify command palette (⌘K) searches across all entity types
- [x] Ensure dark/light theme toggle is consistent across all pages
- [x] Test responsive layout on tablet (768px) and mobile (375px)
- [x] Verify inline editing in grid view with save/cancel/validation feedback

#### P4.6 Report Page Visual & Interaction Polish ✅
- [x] Add `formatValue` utility for number (thousand sep), currency, percent, and date formatting
- [x] Format summary card values and all table cells via `formatValue`
- [x] Format ISO date strings to readable `yyyy-MM-dd` format
- [x] Fix duplicate title rendering in header sections
- [x] Add table horizontal scroll (`overflow-x-auto`), zebra stripes, row hover, and number right-alignment
- [x] Support `renderAs: 'badge'` with `colorMap` on `ReportField` for status fields
- [x] Replace loading text with Skeleton placeholders for modern loading UX

### P5. Documentation 📖 (Completed Foundation)

**Goal:** Comprehensive, accurate, and easy-to-navigate documentation.

> ✅ **Foundation complete** — All documentation items from the Feb 2026 audit are resolved.

#### P5.1 Guide Content ✅
- [x] Verify "Getting Started" guide stays current with latest API
- [x] Write "Building a CRUD App" end-to-end tutorial
- [x] Write "Custom Plugin Development" guide
- [x] Write "Theming & Customization" guide
- [x] Add deployment guides for examples

#### P5.2 API Reference ✅
- [x] Generate API reference docs from TypeScript types
- [x] Document all schema types with annotated examples
- [x] Add interactive schema playground on documentation site
- [x] Document expression engine syntax and all built-in functions

#### P5.3 Storybook as Living Documentation ✅
- [x] Ensure Storybook serves as the primary component reference
- [x] Add usage documentation (MDX) alongside each component story
- [x] Add accessibility notes for each component
- [x] Deploy Storybook to a publicly accessible URL

#### P5.4 Architecture & Internals ✅
- [x] Document the layer architecture with data flow diagrams
- [x] Document the plugin system architecture
- [x] Add troubleshooting guide for common development issues
- [x] Document CI/CD pipeline architecture

### P6. Mobile User Experience 📱

**Goal:** Every component and page delivers a native-quality experience on phones and tablets — responsive layout, touch-friendly interactions, and fast performance on mobile networks.

> ✅ **Implementation largely complete.** Remaining items are testing and quality assurance.

#### P6.1 Plugin Views — Mobile-First Layouts

Each plugin view must work seamlessly from 320px (small phone) to 2560px (ultrawide).

##### ObjectGrid (`plugin-grid`)
- [x] Wrap data table in `overflow-x-auto` container for horizontal scroll on mobile
- [x] Add responsive toolbar: stack filter/sort/search controls vertically below `sm:` breakpoint
- [x] Collapse non-essential columns on mobile via `hidden sm:table-cell` pattern
- [x] Scale row padding: `px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2.5`
- [x] Add mobile card-view fallback for screens below 480px (toggle between table and card layout)
- [x] Ensure touch targets ≥ 44px for all interactive row elements
- [x] Airtable-style auto-type inference for date, select/badge, boolean, and user fields
- [x] Airtable-style BooleanCellRenderer using Checkbox instead of Badge
- [x] Airtable-style row number column (showRowNumbers)
- [x] Airtable-style compact row density (tighter padding, 13px font)
- [x] Default freeze first column (frozenColumns: 1)
- [x] Mobile card view visual hierarchy: Name as bold title, Amount+Stage side-by-side, date formatting
- [x] Mobile card view currency formatting (Amount displayed as $150,000.00)
- [x] Mobile card view Stage colored badge (green/red/yellow/blue by pipeline stage)
- [x] Mobile card view skeleton loading placeholders during async data fetch
- [x] CRM example Opportunity stage field with color options
- [x] Airtable-style record count status bar (`{n} records`) in ListView
- [x] ListView record count i18n keys (`list.recordCount` / `list.recordCountOne`) in all 11 locale files
- [x] Airtable-style "+ Add record" row (showAddRow / onAddRecord) in data-table
- [x] Airtable-style compound cells with prefix badge configuration (ListColumn.prefix)
- [x] Airtable-style datetime split display (date + muted time for created_at/updated_at fields)
- [x] Airtable-style row refinement (pure white bg, border-border/50, hover:bg-muted/30)
- [x] Airtable-style inline sort arrows (smaller h-3 icons, hidden until hover, colored when active)
- [x] Airtable-style column header type icons (Type/Hash/Calendar/Clock/CheckSquare/User/Tag)
- [x] Airtable-style primary field auto-link (first column clickable to open record detail)
- [x] Airtable-style row hover expand button (appears on row number hover)
- [x] Airtable-style column header context menu (right-click for sort/hide)
- [x] Airtable-style form-based record detail panel (replaces key-value dump)
- [x] Airtable-style empty value display (italic muted indicator instead of plain dash)
- [x] Grid i18n keys in all 10 locale files (grid.actions, grid.edit, grid.delete, grid.export, etc.)
- [x] Auto-infer currency type for amount/price/total fields in grid columns
- [x] Type-aware rendering in record detail panel (date, currency, boolean, select via getCellRenderer)
- [x] Type-aware rendering in DetailSection (date formatting, currency formatting, select badges)

##### ObjectKanban (`plugin-kanban`)
- [x] Stack columns vertically on mobile with horizontal swipe navigation between columns
- [x] Scale card sizing: `p-2 sm:p-3 md:p-4` with responsive typography
- [x] Add touch-friendly drag-and-drop via `useGesture` (long-press to initiate, haptic feedback)
- [x] Column headers: `text-sm sm:text-base` with truncation on mobile
- [x] Add column count badge and swipe indicator on mobile
- [x] Limit visible card fields on mobile (show title + status only, expand on tap)

##### ObjectForm (`plugin-form`)
- [x] Ensure mobile-first column stacking: 1 column on `xs`, 2 on `sm:`, 3+ on `md:`
- [x] Scale field labels: `text-xs sm:text-sm` with proper spacing
- [x] Make action buttons full-width on mobile: `w-full sm:w-auto`
- [x] Increase touch targets for all form controls (min 44×44px)
- [x] Optimize select/dropdown fields for mobile (bottom sheet pattern on phones)
- [x] Ensure date pickers and multi-select fields are mobile-friendly
- [x] Auto-Layout: infer optimal columns from field count (≤3 → 1 col, ≥4 → 2 cols)
- [x] Auto-Layout: smart colSpan for wide fields (textarea/markdown/html/grid → full row)
- [x] Auto-Layout: filter auto-generated fields (formula/summary/auto_number) in create mode
- [x] Auto-Layout: user configuration always takes priority over inferred defaults
- [x] Auto-Layout: apply in ModalForm/DrawerForm variants (not just SimpleObjectForm)
- [x] Auto-Layout: auto-upgrade modal size when inferred columns > 1 (2→lg, 3→xl, 4+→full)
- [x] Auto-Layout: DetailView/DetailSection auto-infer columns (≤3→1, 4-10→2, 11+→3) with wide field auto-spanning
- [x] Console: replace hardcoded Sheet drawer with NavigationOverlay (supports drawer/modal/split/popover via ViewNavigationConfig)
- [x] Console: migrate Dialog+ObjectForm to ModalForm as unified modal form entry (#619)

##### ObjectDashboard (`plugin-dashboard`)
- [x] Implement responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- [x] Scale widget padding: `p-3 sm:p-4 md:p-6` per widget card
- [x] Stack dashboard header controls on mobile (title above actions)
- [x] Add swipeable widget carousel option for mobile
- [x] Chart widgets: reduce axis label density on mobile

##### ObjectCalendar (`plugin-calendar`)
- [x] Replace fixed `h-[calc(100vh-200px)]` with responsive height: `h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] md:h-[calc(100vh-200px)]`
- [x] Default to day or agenda view on mobile (month view unreadable on phones)
- [x] Add swipe-to-navigate between days/weeks on mobile via `useGesture`
- [x] Scale event text: `text-xs sm:text-sm` with single-line truncation
- [x] Make event creation touch-friendly (long-press on timeslot)
- [x] Fix event click always dispatches action (removed invalid `schema.onEventClick` guard)
- [x] Locale-aware weekday headers and UI strings (Today, New, Day/Week/Month, +N more)
- [x] Add tooltip (`title` attribute) on truncated event titles in all views
- [x] Enhance cross-month date visual distinction (`opacity-50` for non-current-month dates)
- [x] Improve today highlight spacing with event cards (`mb-2`)
- [x] Remove duplicate "New Event" button from calendar area (page-level New button is sufficient)
- [x] Forward `...props` in ObjectCalendarRenderer so `onRowClick` from ListView is propagated

##### ObjectTimeline (`plugin-timeline`)
- [x] Switch from side-by-side to single-column layout on mobile
- [x] Scale item padding: `p-2 sm:p-3 md:p-4` with responsive typography
- [x] Truncate event descriptions on mobile with "Show more" expand
- [x] Add pull-to-refresh via `usePullToRefresh` for timeline data

##### ObjectList (`plugin-list`)
- [x] Stack toolbar controls vertically on mobile with collapsible filter panel
- [x] Scale search bar: `w-full sm:w-48 lg:w-64` (full-width on mobile)
- [x] Responsive list item padding: `px-2 sm:px-3 md:px-4`
- [x] Ensure action menus use bottom sheet on mobile instead of popovers
- [x] Touch-friendly row selection (checkbox size ≥ 44px)

##### DetailView (`plugin-detail`)
- [x] Stack header actions vertically on narrow screens: `flex-col sm:flex-row`
- [x] Full-width action buttons on mobile: `w-full sm:w-auto`
- [x] Scale section padding: `p-3 sm:p-4 md:p-6`
- [x] Convert metadata panel to bottom drawer on mobile
- [x] Increase field value touch targets for copy-to-clipboard

##### Charts (`plugin-charts`)
- [x] Set responsive chart heights: `h-48 sm:h-64 md:h-80 lg:h-96`
- [x] Reduce axis label count on mobile to prevent overlap
- [x] Enable touch-to-inspect data points (tooltip on tap)
- [x] Stack legend below chart on mobile: `flex-col sm:flex-row`

##### Map (`plugin-map`)
- [x] Enable pinch-to-zoom and two-finger pan on mobile
- [x] Scale info popup sizing for mobile screens
- [x] Add mobile-friendly location search with bottom sheet
- [x] Ensure map controls (zoom, layer toggle) are touch-accessible

##### Gantt (`plugin-gantt`)
- [x] Add horizontal scroll container with touch momentum
- [x] Scale bar heights: `h-6 sm:h-8 md:h-10`
- [x] Collapse task details on mobile (show name only, expand on tap)
- [x] Add responsive zoom levels (day view on mobile, week on tablet, month on desktop)

#### P6.2 Console Pages — Responsive Layouts

##### AppHeader
- [x] Ensure all header actions are accessible on mobile (overflow menu for hidden actions)
- [x] Add mobile-specific command palette trigger (prominent search icon)
- [x] Scale header height: `h-12 sm:h-14 md:h-16`
- [x] Responsive breadcrumb: show only current page on mobile, full path on desktop

##### AppSidebar
- [x] Auto-collapse to icon-only mode on tablet, full overlay on mobile
- [x] Add swipe-from-edge gesture to open sidebar on mobile via `useGesture`
- [x] Scale menu item padding for touch: `py-2.5 sm:py-2` (larger on mobile)
- [x] Bottom navigation bar option for mobile (5-item tab bar)

##### DashboardView (Console)
- [x] Stack title and metadata toggle vertically on mobile
- [x] Scale heading: `text-lg sm:text-xl md:text-2xl`
- [x] Add responsive padding: `p-3 sm:p-4 md:p-6 lg:p-8`
- [x] Optimize metadata panel as collapsible accordion on mobile

##### RecordDetailView
- [x] Scale dialog width: `w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:max-w-2xl lg:max-w-4xl`
- [x] Stack field label and value vertically on mobile
- [x] Add responsive padding: `p-3 sm:p-4 md:p-6`
- [x] Ensure inline editing works with on-screen keyboard

##### Create/Edit Dialogs
- [x] Full-screen modal on mobile: `h-[100dvh] sm:h-auto sm:max-h-[90vh]`
- [x] Sticky action buttons at bottom on mobile
- [x] Add swipe-to-dismiss for mobile dialogs
- [x] Close button touch target ≥ 44×44px on mobile (WCAG 2.5.5)
- [x] Skeleton loading state for form fields (replaces spinner)
- [x] Flex layout with sticky header + scrollable body + sticky footer

#### P6.3 Core Component Primitives

##### DataTable (`components/renderers/complex`)
- [x] Add outer `overflow-x-auto` wrapper with `-webkit-overflow-scrolling: touch`
- [x] Scale pagination controls: full-width on mobile with larger touch targets
- [x] Responsive column visibility system (priority-based column hiding)
- [x] Mobile-optimized search/filter bar: full-width, collapsible
- [x] Horizontal scroll indicator (shadow/gradient) on mobile

##### Form Renderer (`components/renderers/form`)
- [x] Verify responsive column mapping works correctly for all column counts (1–4)
- [x] Ensure wizard/stepper variant shows 1 step at a time on mobile
- [x] Scale step indicators for mobile: `text-xs sm:text-sm`, smaller circles
- [x] Full-width submit/cancel buttons on mobile
- [x] Force single-column layout on mobile: 2-col starts at `md:` (768px) instead of `sm:` (640px)

##### Navigation Components
- [x] Breadcrumb: truncate to current + parent on mobile with "..." overflow
- [x] Tab navigation: horizontal scroll with `overflow-x-auto` for many tabs
- [x] DropdownMenu: use bottom sheet pattern on mobile via `useIsMobile()` detection

#### P6.4 Mobile Infrastructure Enhancements

##### Touch & Gesture System
- [x] Integrate `usePullToRefresh` into all data-fetching views (Grid, List, Timeline, Calendar)
- [x] Add swipe-to-go-back gesture for Console navigation
- [x] Integrate `useTouchTarget` hook to enforce minimum 44px touch targets across all interactive elements
- [x] Add haptic feedback triggers for drag-and-drop completion

##### Performance on Mobile Networks
- [x] Implement progressive image loading for all image fields and avatars
- [x] Add connection-aware data fetching (reduce page size on slow connections)
- [x] Enable service worker caching for static assets via `registerServiceWorker`
- [x] Add `loading="lazy"` to all below-fold images and iframes

##### PWA Support
- [x] Integrate `MobileProvider` into Console app root with PWA configuration
- [x] Generate app manifest via `generatePWAManifest()` utility
- [x] Add app install prompt for mobile browsers
- [x] Implement offline indicator and cached-data fallback

##### Viewport & Input Handling
- [x] Handle virtual keyboard resize (100dvh instead of 100vh for mobile)
- [x] Prevent zoom on input focus (`font-size: 16px` minimum for inputs)
- [x] Add viewport meta tag validation in Console HTML template
- [x] Support safe-area-inset for notched devices (`env(safe-area-inset-*)`)

#### P6.5 Testing & Quality Assurance

- [x] Add Playwright mobile viewport tests (iPhone SE 375px, iPhone 14 390px, iPad 768px)
- [ ] Add visual regression tests for all views at mobile breakpoints
- [ ] Add touch interaction tests (swipe, pinch, long-press) via Playwright touch emulation
- [ ] Verify all views pass axe-core at mobile viewport sizes
- [ ] Add Storybook mobile viewport decorator for all component stories
- [ ] Test on-screen keyboard interaction for all form fields
- [ ] Performance benchmark on simulated mobile CPU (4× slowdown) and 3G network

#### P6.6 Mobile-Specific Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Touch Target Compliance** | 100% ≥ 44px | Automated scan via `useTouchTarget` |
| **Mobile Lighthouse Score** | ≥ 90 (Performance, Accessibility) | Lighthouse CI on mobile preset |
| **First Contentful Paint (Mobile 3G)** | < 1.5s | Lighthouse / Web Vitals |
| **Time to Interactive (Mobile 3G)** | < 3.5s | Lighthouse / Web Vitals |
| **Responsive Breakpoint Coverage** | All 13+ views × 3 breakpoints | Playwright viewport tests |
| **Mobile Gesture Coverage** | Swipe, pinch, long-press in all applicable views | E2E gesture tests |
| **PWA Install Success** | Manifest + service worker valid | Lighthouse PWA audit |

---

## 🔮 Future Vision (Deferred)

> The following items are **not** in the current sprint. They will be re-evaluated once P0–P1 (v1.0 UI essentials and spec compliance) are complete.

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
| **Spec Compliance** | 98% | 100% (UI-facing) | ROADMAP_SPEC.md |
| **View Navigation** | 6/7 views | 7/7 views (incl. Gallery) | Navigation compliance matrix |
| **ListView Spec Props** | 0/11 | 3/11 (emptyState, hiddenFields, quickFilters) | Spec property coverage |
| **Timeline Spec Alignment** | Non-standard | Fully aligned (startDateField, endDateField, etc.) | Type contract audit |
| **Console CRUD** | Callback-based | ActionEngine pipeline | ActionEngine integration test |
| **Build Status** | 42/42 pass | 42/42 pass | `pnpm build` |

### Quality Metrics (Ongoing)

| Metric | Current (Feb 2026) | Target | How Measured |
|--------|--------------------|--------------------|--------------|
| **Test Coverage** | 90%+ | 90%+ | `pnpm test:coverage` |
| **Test Count** | 3,535+ | 4,000+ | `pnpm test` summary |
| **Storybook Stories** | 78 | 91+ (1 per component) | Story file count |
| **Package READMEs** | 37/37 (100%) | 37/37 (100%) | README.md presence |
| **Hooks with JSDoc** | 20+/20+ (100%) | 20+/20+ (100%) | Grep `/** */` in hooks |
| **Console i18n Coverage** | 100% | 100% | No hardcoded strings |
| **WCAG AA Compliance** | Full Console pages | Full Console pages | axe-core audit |
| **CLI Commands Working** | 15 | 15 (all verified, oclif plugin) | `os ui --help` |
| **TODO/FIXME Count** | 0 files | 0 | Grep `TODO\|FIXME\|HACK` |

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

### Mobile UX Success Criteria
- [ ] All 13+ views render correctly at 375px viewport (iPhone SE)
- [ ] Touch targets ≥ 44px for all interactive elements
- [ ] Console Lighthouse mobile score ≥ 90 (Performance + Accessibility)
- [ ] All views support horizontal scroll or responsive stacking on mobile
- [ ] Swipe gestures work for navigation, Kanban columns, and Calendar days

---

## ⚠️ Risk Management

| Risk | Mitigation |
|------|------------|
| **v1.0 ships without spec compliance** | P0 prioritizes UI-facing spec compliance; non-UI spec areas deferred to P1 |
| **Spec changes (post v3.0.0)** | Strict "import, never redefine" rule; type updates propagate automatically |
| **Performance regression** | Performance budgets in CI, PerformanceConfigSchema monitoring, 10K-record benchmarks |
| **i18n regression (new hardcoded strings)** | ESLint rule to detect string literals in JSX; i18n coverage metric in CI |
| **Component API inconsistency** | Audit checklist, automated prop-type validation, Storybook as source of truth |
| **Documentation drift** | TSDoc generation from source, Storybook stories alongside code, link checker CI |
| **Accessibility regression** | axe-core tests on full Console pages (not just primitives), WCAG AA CI check |
| **Mobile responsiveness regression** | Playwright mobile viewport tests, Lighthouse CI mobile preset, touch target audit |

---

## 📚 Reference Documents

- [ROADMAP_SPEC.md](./ROADMAP_SPEC.md) — Per-package @objectstack/spec v3.0.0 compliance evaluation (98% current)
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

**Roadmap Status:** 🎯 Active — v1.0 UI Essentials · Spec Compliance · Component Excellence
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
