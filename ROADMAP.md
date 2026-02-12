# ObjectUI Development Roadmap

> **Last Updated:** February 12, 2026  
> **Current Version:** v0.5.x  
> **Target Version:** v2.0.0  
> **Spec Version:** @objectstack/spec v3.0.0  
> **Client Version:** @objectstack/client v3.0.0  
> **Current Priority:** 🔮 v3.0.0 Deep Integration & 2027 Vision (N.1–N.5)

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces — dashboards, kanbans, CRUDs, workflows, and more.

With the release of @objectstack/spec v3.0.0 and @objectstack/client v3.0.0, the protocol has reached a major milestone: consolidated namespaces (Hub → Cloud, auth/driver/permission merged into security/system), streamlined PaginatedResult API (records/total), and enhanced metadata access patterns. The client SDK remains **100% spec-compliant** (13/13 API namespaces, 95+ methods).

ObjectUI's current overall compliance stands at **98%**. All existing functionality remains stable — **42/42 builds pass**, **3235/3235 tests pass**. This roadmap defines the path to 100% v3.0.0 compliance and commercial readiness.

**🔮 Current Focus: v3.0.0 Deep Integration & 2027 Vision**

> All Q1–Q3 2026 foundation items and Console v1.0 Production Release are **complete**. The immediate priority is now the **Next Phase (N.1–N.5)**: deep v3.0.0 integration, designer completion, ecosystem & marketplace, community growth, and the 2027 platform vision. These items have been elevated to P0/P1/P2 priority and are the primary focus of all active development.

**Strategic Goals:**
- **Technical Excellence:** 100% @objectstack/spec v3.0.0 compliance, 80%+ test coverage, world-class performance
- **Enterprise-Ready:** Multi-tenancy, RBAC, real-time collaboration, offline-first architecture
- **Global Reach:** 10+ languages, 10,000+ GitHub stars, 50,000+ weekly NPM downloads
- **Commercial Success:** ObjectUI Cloud platform, 100+ enterprise customers, $2M+ annual revenue

> 📄 Companion documents:
> - [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) — Per-package spec compliance evaluation (82% current, 63 improvement items)
> - [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — Client SDK evaluation (100% protocol coverage, 13/13 namespaces)

---

## 🎯 Current Status (February 2026)

### Achievements ✅

**Architecture & Quality:**
- ✅ 35 packages in monorepo (20 plugins, 4 core, 11 tools)
- ✅ 91+ components fully documented
- ✅ 57+ Storybook stories with interactive demos
- ✅ TypeScript 5.9+ strict mode (100%)
- ✅ React 19 + Tailwind CSS + Shadcn UI
- ✅ All 42 builds pass, all 3185+ tests pass
- ✅ @objectstack/client v3.0.0 integration validated (100% protocol coverage)

**Core Features (Complete):**
- ✅ All 13+ view types implemented (Grid, Kanban, Calendar, Form, Detail, List, Dashboard, Charts, Editor, Markdown, Chatbot, Gantt, Timeline, Map, Report)
- ✅ Form variants (simple, tabbed, wizard, split, drawer, modal)
- ✅ NavigationConfig (7 modes: page, drawer, modal, split, popover, new_window, none)
- ✅ Action System (5 types: script, url, modal, flow, api)
- ✅ Theme System (spec-aligned, CSS custom properties, dark mode)
- ✅ Page System (4 types: record, home, app, utility with region-based layouts)
- ✅ @object-ui/i18n (10 languages, RTL, date/currency formatting)
- ✅ @object-ui/auth (AuthProvider, useAuth, AuthGuard, login/register/password-reset)
- ✅ @object-ui/permissions (RBAC, object/field/row-level permissions)
- ✅ @object-ui/tenant (multi-tenancy, branding, scoped queries)
- ✅ Console app with MSW mock backend, system admin UIs
- ✅ I18nLabel handling via `resolveI18nLabel()` — supports `string | { key, defaultValue?, params? }`

### Current Compliance (vs. @objectstack/spec v3.0.0)

| Category | Current | Target |
|----------|---------|--------|
| **UI Types** | 100% | 100% |
| **API Protocol** | 95% | 100% |
| **Feature Completeness** | 98% | 100% |
| **v3.0.0 New Areas** | 100% | 100% |
| **Overall** | **98%** | **100%** |

> Source: [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) §8

---

## 🏗️ Architecture Overview

ObjectUI operates on a **three-layer model** that cleanly separates protocol, types, and implementation:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: @objectstack/spec v3.0.0 (The Protocol)                  │
│  Pure TypeScript type definitions — Data, UI, System, AI, API      │
│  12 export modules: data, ui, system, kernel, ai, automation,      │
│  api, contracts, integration, security, studio, cloud              │
│  ❌ No runtime code. No React. No dependencies.                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ imports (never redefines)
┌──────────────────────────────▼──────────────────────────────────────┐
│  Layer 2: @object-ui/types (The Bridge)                             │
│  Re-exports all spec types + ObjectUI-specific schemas              │
│  AnySchema discriminated union, FieldWidgetProps, ViewSchemas       │
│  ❌ No runtime code. Zero dependencies.                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ consumed by
┌──────────────────────────────▼──────────────────────────────────────┐
│  Layer 3: Plugin Implementations (The Runtime)                      │
│                                                                     │
│  @object-ui/core ─── Registry, Expressions, Validation, Actions     │
│  @object-ui/react ── SchemaRenderer, Hooks, Providers               │
│  @object-ui/components ── 90+ Shadcn-based renderers                │
│  @object-ui/fields ── 35+ field widgets (text, number, date, ...)   │
│  @object-ui/layout ── AppShell, Page, SidebarNav                    │
│  @object-ui/plugin-* ── Grid, Kanban, Calendar, Charts, ...        │
│  @object-ui/auth/tenant/permissions/i18n ── Infrastructure          │
│  @object-ui/data-objectstack ── ObjectStackAdapter (DataSource)     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key principles:**
1. **Spec types are never redefined** — always imported from @objectstack/spec
2. **Plugins are lazy-loaded** — heavy dependencies (AG Grid, MapLibre, Monaco) only load on demand
3. **Backend agnostic** — ObjectUI is the official renderer for ObjectStack but works with any JSON metadata source

---

## 📐 @objectstack/spec v3.0.0 Compliance Plan

The v3.0.0 spec is a major consolidation release that streamlines the protocol surface:
- **Namespace consolidation:** `Hub` → `Cloud`, `auth`/`driver`/`permission` merged into `security`/`system`/`kernel`
- **API modernization:** `PaginatedResult` uses `records`/`total` (replacing `value`/`count`), `meta.getItem('object', name)` replaces `meta.getObject(name)`
- **New sub-modules:** `./contracts`, `./integration`, `./security`, `./studio` exports stabilized
- All 12+ export entry points maintained: `./`, `./data`, `./system`, `./kernel`, `./ai`, `./automation`, `./api`, `./ui`, `./contracts`, `./integration`, `./security`, `./studio`

This section maps each domain to its current ObjectUI status and implementation plan.

### What's Done ✅

| Domain | Spec Types | Status | Package |
|--------|-----------|--------|---------|
| **Theme System** | ColorPalette, Typography, Spacing, etc. | ✅ Complete | core, components |
| **View Types** | All 13+ view schemas | ✅ Complete | plugin-* |
| **Action System** | UIActionSchema (5 types), BatchOps, Undo/Redo | ✅ Complete | core, react |
| **Form System** | 6 variants, 35+ field types | ✅ Complete | plugin-form, fields |
| **Permission UI** | RBAC, field/row-level, guards | ✅ Complete | permissions |
| **I18nLabel** | `string \| { key, defaultValue?, params? }` | ✅ Complete | react (`resolveI18nLabel()`) |
| **DataSource** | ObjectStackAdapter, MetadataCache | ✅ Complete | data-objectstack |
| **Auth** | Token injection, session, OAuth | ✅ Complete | auth |
| **Multi-Tenancy** | Tenant scoping, branding | ✅ Complete | tenant |

### What's New in v3.0.0 (Implementation Required)

| Domain | Key Spec Types | Current Status | Target Quarter |
|--------|---------------|----------------|----------------|
| **Accessibility** | AriaPropsSchema, WcagContrastLevel | ✅ Complete (types re-exported, AriaProps injection, WCAG contrast utilities) | Q1 2026 |
| **Responsive Design** | ResponsiveConfigSchema, BreakpointColumnMapSchema, BreakpointOrderMapSchema | ✅ Complete (spec schemas consumed, useResponsiveConfig) | Q1 2026 |
| **I18n Deep Integration** | I18nObjectSchema, LocaleConfigSchema, PluralRuleSchema, DateFormatSchema, NumberFormatSchema | ✅ Complete (all types re-exported and consumed) | Q1 2026 |
| **Drag and Drop** | DndConfigSchema, DragItemSchema, DropZoneSchema, DragConstraintSchema, DropEffectSchema | ✅ Complete — DndProvider + useDnd, plugin bridges (Kanban, Dashboard, Calendar) | Q2 2026 |
| **Gestures / Touch** | GestureConfigSchema, SwipeGestureConfigSchema, PinchGestureConfigSchema, LongPressGestureConfigSchema, TouchInteractionSchema | ✅ Complete — useSpecGesture, useTouchTarget, spec schema integration | Q2 2026 |
| **Focus / Keyboard** | FocusManagementSchema, FocusTrapConfigSchema, KeyboardNavigationConfigSchema, KeyboardShortcutSchema | ✅ Complete — useFocusTrap, useKeyboardShortcuts, getShortcutDescriptions | Q2 2026 |
| **Animation / Motion** | ComponentAnimationSchema, MotionConfigSchema, TransitionConfigSchema, EasingFunctionSchema | ✅ Complete — useAnimation (7 presets), useReducedMotion | Q2 2026 |
| **Notifications** | NotificationSchema, NotificationConfigSchema, NotificationActionSchema, NotificationPositionSchema | ✅ Complete — NotificationProvider, useNotifications with full CRUD | Q2 2026 |
| **View Enhancements** | ColumnSummarySchema, GalleryConfigSchema, GroupingConfigSchema, RowColorConfigSchema, RowHeightSchema, ViewSharingSchema, DensityMode | ✅ Complete — useColumnSummary, useDensityMode, useViewSharing, useGroupedData, useRowColor, ObjectGallery | Q2 2026 |
| **Offline / Sync** | OfflineConfigSchema, SyncConfigSchema, ConflictResolutionSchema, EvictionPolicySchema | ✅ Complete — useOffline (offline detection, sync queue, conflict resolution, auto-sync) | Q3 2026 |
| **Performance** | PerformanceConfigSchema | ✅ Complete — usePerformance (metrics tracking, cache strategy, virtual scroll config, debounce) | Q3 2026 |
| **Page Transitions** | PageTransitionSchema, PageComponentType | ✅ Complete — usePageTransition (9 transition types, easing, crossFade, reduced-motion aware) | Q3 2026 |

### v3.0.0 Migration (Completed ✅)

| Breaking Change | Migration | Status |
|----------------|-----------|--------|
| `Hub` namespace → `Cloud` | Re-export `Cloud` instead of `Hub` in @object-ui/types | ✅ Complete |
| `definePlugin` removed | Removed re-export from @object-ui/types; `defineStack` remains | ✅ Complete |
| `PaginatedResult.value` → `.records` | Updated all data plugins, adapters, and examples | ✅ Complete |
| `PaginatedResult.count` → `.total` | Updated data-objectstack adapter and examples | ✅ Complete |
| `client.meta.getObject(name)` → `client.meta.getItem('object', name)` | Updated data-objectstack adapter and examples | ✅ Complete |

---

## 🗺️ 2026 Development Roadmap

### Q1 2026: Foundation & v3.0.0 Alignment (Feb-Mar)

**Goal:** Strengthen foundation, begin v3.0.0 spec alignment, improve quality

#### 1.1 I18nLabel Handling ✅ Complete
- [x] Implement `resolveI18nLabel()` utility in @object-ui/react
- [x] Handle `string | { key, defaultValue?, params? }` across all schema label/placeholder/helpText/description fields
- [x] Integration with @object-ui/i18n i18next backend

#### 1.2 Accessibility — AriaProps & WCAG ✅ Complete
**Target:** Spec-compliant accessibility across all renderers

- [x] Implement AriaPropsSchema injection in SchemaRenderer and component renderers
- [x] Add WcagContrastLevel checking utility for theme color validation (`contrastRatio()`, `meetsContrastLevel()`)
- [x] Add ARIA role, label, and description propagation to all Shadcn primitives
- [x] Audit all 90+ components for WCAG 2.1 AA compliance
- [x] Add automated accessibility tests (axe-core integration)

**Spec Reference:** `AriaPropsSchema`, `WcagContrastLevel`

#### 1.3 Responsive Design — Breakpoint-Aware Layouts ✅ Complete
**Target:** Consume v3.0.0 responsive schemas in layout system

- [x] Adopt ResponsiveConfigSchema and BreakpointColumnMapSchema in @object-ui/layout (`ResponsiveGrid`)
- [x] Implement BreakpointOrderMapSchema for column reordering at breakpoints (`useResponsiveConfig`)
- [x] Integrate spec breakpoint types with existing @object-ui/mobile breakpoint system
- [x] Add responsive layout stories in Storybook

**Spec Reference:** `ResponsiveConfigSchema`, `BreakpointColumnMapSchema`, `BreakpointOrderMapSchema`, `BreakpointName`

#### 1.4 Test Coverage Improvement ✅ Complete
**Target:** 80%+ line coverage

- [x] Add tests for all core modules (@object-ui/core)
- [x] Add tests for all components (@object-ui/components)
- [x] Add E2E test framework (Playwright)
- [x] Add performance benchmark suite (vitest bench)
- [x] Visual regression tests (Storybook snapshot + Chromatic)
- [x] Accessibility test suite (axe-core)

#### 1.5 I18n Deep Integration ✅ Complete
**Target:** Consume advanced v3.0.0 i18n types beyond I18nLabel

- [x] Consume I18nObjectSchema for object-level locale configuration
- [x] Consume LocaleConfigSchema for per-tenant/per-user locale preferences (`applyLocaleConfig()`)
- [x] Consume PluralRuleSchema for plural-aware translations (`resolvePlural()`)
- [x] Consume DateFormatSchema and NumberFormatSchema for locale-aware formatting (`formatDateSpec()`, `formatNumberSpec()`)
- [x] Add dynamic language pack loading (lazy import via `loadLanguage` prop in I18nProvider)

**Spec Reference:** `I18nObjectSchema`, `LocaleConfigSchema`, `PluralRuleSchema`, `DateFormatSchema`, `NumberFormatSchema`

#### 1.6 Critical Bug Fixes ✅ Complete
- [x] Implement DataScope module in @object-ui/core (row-level security enforcement) — **P0**
- [x] Replace console.log placeholders in plugin-ai handlers — **P0** (proper callbacks implemented)
- [x] Complete API data fetching in plugin-detail (DetailView, RelatedList) — **P1**
- [x] Add coordinate error handling in plugin-map — **P1** (validation + warning banner)
- [x] Implement ReportViewer data refresh — **P1** (onRefresh callback pattern)

**Q1 Milestone:**
- **v0.6.0 Release (March 2026):** Accessibility foundations, responsive layouts, i18n deep integration, 80%+ test coverage
- **Spec compliance: 82% → 86%**

---

### Q2 2026: Interactive Experience (Apr-Jun)

**Goal:** Implement interactive protocol areas — DnD, gestures, focus, animation, notifications, view enhancements

#### 2.1 Drag and Drop Framework (3 weeks)
**Target:** Spec-compliant DnD system across all draggable views

- [x] Implement DndConfigSchema-based DnD framework (unified API for Kanban, Dashboard, Calendar, Grid) — `DndProvider`, `useDnd` in @object-ui/react
- [x] Consume DragItemSchema, DropZoneSchema, DragConstraintSchema, DropEffectSchema — types re-exported from @object-ui/types
- [x] Refactor plugin-kanban card drag to use spec DnD schemas — DndBridge bridges @dnd-kit events to ObjectUI DndProvider
- [x] Refactor plugin-dashboard widget drag to use spec DnD schemas — DndEditModeBridge bridges edit mode to DndProvider
- [x] Add drag-to-reschedule for calendar events — native HTML5 DnD in MonthView with `onEventDrop` callback
- [x] Add drag-and-drop sidebar navigation reordering — HTML5 native DnD in AppSidebar with localStorage persistence per app

**Spec Reference:** `DndConfigSchema`, `DragItemSchema`, `DropZoneSchema`, `DragConstraintSchema`, `DragHandleSchema`, `DropEffectSchema`

#### 2.2 Gesture & Touch Support (2 weeks)
**Target:** Mobile-first gesture handling aligned with spec schemas

- [x] Integrate GestureConfigSchema and TouchInteractionSchema into @object-ui/mobile hooks — `useSpecGesture` hook
- [x] Consume SwipeGestureConfigSchema for navigation gestures — integrated in `useSpecGesture`
- [x] Consume PinchGestureConfigSchema for zoom interactions (maps, images) — integrated in `useSpecGesture`
- [x] Consume LongPressGestureConfigSchema for context menus — integrated in `useSpecGesture`
- [x] Consume TouchTargetConfigSchema for minimum touch target sizes (44px) — `useTouchTarget` hook

**Spec Reference:** `GestureConfigSchema`, `SwipeGestureConfigSchema`, `PinchGestureConfigSchema`, `LongPressGestureConfigSchema`, `TouchInteractionSchema`, `TouchTargetConfigSchema`

#### 2.3 Focus Management & Keyboard Navigation (2 weeks)
**Target:** Enterprise keyboard accessibility

- [x] Implement FocusManagementSchema runtime in @object-ui/react — `useFocusTrap` hook
- [x] Implement FocusTrapConfigSchema for modal/drawer focus trapping — `useFocusTrap` with autoFocus, restoreFocus, escapeDeactivates
- [x] Implement KeyboardNavigationConfigSchema for grid/list navigation (arrow keys, tab order) — `useKeyboardShortcuts` hook
- [x] Implement KeyboardShortcutSchema system with help dialog (? key) — `useKeyboardShortcuts` + `getShortcutDescriptions` utility
- [x] Add keyboard shortcuts for common CRUD operations — `useCrudShortcuts` hook (Ctrl+N/E/S/D, Delete, Escape, Ctrl+F)

**Spec Reference:** `FocusManagementSchema`, `FocusTrapConfigSchema`, `KeyboardNavigationConfigSchema`, `KeyboardShortcutSchema`

#### 2.4 Animation & Motion System (2 weeks)
**Target:** Smooth, performant animations aligned with spec

- [x] Implement ComponentAnimationSchema runtime (enter/exit/hover/focus transitions) — `useAnimation` hook with preset-based transitions
- [x] Implement MotionConfigSchema for reduced-motion preferences (`prefers-reduced-motion`) — `useReducedMotion` hook
- [x] Implement TransitionConfigSchema and TransitionPresetSchema for view transitions — `useAnimation` with 7 presets (fade, slide-up/down/left/right, scale, scale-fade)
- [x] Implement EasingFunctionSchema for consistent easing curves — easing presets (linear, ease, ease-in, ease-out, ease-in-out, spring)
- [x] Add animation to view switcher transitions — fade-in animation via Tailwind CSS `animate-in` classes

**Spec Reference:** `ComponentAnimationSchema`, `AnimationTriggerSchema`, `MotionConfigSchema`, `TransitionConfigSchema`, `TransitionPresetSchema`, `EasingFunctionSchema`

#### 2.5 View Enhancements (3 weeks)
**Target:** Consume v3.0.0 view enhancement schemas in grid/list plugins

- [x] Consume GalleryConfigSchema in plugin-list (gallery view layout, image sizing, masonry mode) — ObjectGallery with coverField/coverFit/cardSize/visibleFields
- [x] Consume ColumnSummarySchema in plugin-grid and plugin-aggrid (column-level SUM/AVG/COUNT) — `useColumnSummary` hook
- [x] Consume GroupingConfigSchema and GroupingFieldSchema in plugin-grid (row grouping with subtotals) — `useGroupedData` hook with collapsible sections
- [x] Consume RowColorConfigSchema for conditional row coloring rules — `useRowColor` hook with field-value color mapping
- [x] Consume RowHeightSchema for compact/comfortable/spacious row height modes — `useDensityMode` hook
- [x] Consume DensityMode for grid/list density toggling — `useDensityMode` with cycle()
- [x] Consume ViewSharingSchema for shared/personal view configurations — `useViewSharing` hook with CRUD

**Spec Reference:** `GalleryConfigSchema`, `ColumnSummarySchema`, `GroupingConfigSchema`, `GroupingFieldSchema`, `RowColorConfigSchema`, `RowHeightSchema`, `DensityMode`, `ViewSharingSchema`

#### 2.6 Notification System (2 weeks)
**Target:** Full notification UI integrated with @objectstack/client notifications API

- [x] Implement NotificationSchema-based notification renderer (toast, banner, snackbar, modal) — `NotificationProvider` with severity levels
- [x] Consume NotificationConfigSchema for position, duration, stacking — `NotificationSystemConfig` with all options
- [x] Consume NotificationActionSchema for interactive notifications (buttons, links) — `NotificationActionButton` support
- [x] Implement notification center UI with unread count badge — `useNotifications` with `unreadCount`, `markAsRead`, `markAllAsRead`
- [x] Integrate with `client.notifications.*` API for device registration and preferences — `useClientNotifications` hook

**Spec Reference:** `NotificationSchema`, `NotificationConfigSchema`, `NotificationActionSchema`, `NotificationPositionSchema`, `NotificationSeveritySchema`, `NotificationTypeSchema`

#### 2.7 Console UX Enhancement (Ongoing)
- [x] Skeleton loading states for data-heavy views (grid, dashboard, detail)
- [x] Toast notifications for CRUD operations (create/update/delete)
- [x] Responsive sidebar auto-collapse on tablet breakpoints
- [x] Onboarding walkthrough for first-time users
- [x] Global search results page (beyond command palette)
- [x] Recent items / favorites in sidebar

#### 2.8 Designer UX Enhancement (Feb 2026)
**Target:** Enterprise-quality designer experience across all 5 designers

> 📄 See [DESIGNER_UX_ANALYSIS.md](./DESIGNER_UX_ANALYSIS.md) for full analysis

**Phase 1: Accessibility & Polish ✅ Complete**
- [x] Add ARIA attributes (aria-label, role=toolbar/region/tablist/tab, aria-selected) across all 5 designers
- [x] Add keyboard shortcuts (Delete to remove selected, Escape to deselect) to PageDesigner, DataModelDesigner, ProcessDesigner, ReportDesigner
- [x] Improve empty states with guidance text across all designers
- [x] Add zoom controls (−/+/fit) to PageDesigner canvas
- [x] Improve property panels (PageDesigner label editing, ReportDesigner element details)
- [x] Add ConnectionStatusIndicator component to CollaborationProvider
- [x] Expand user color palette from 8 to 16 colors
- [x] Add tab accessibility (role=tablist, role=tab, aria-selected) to ViewDesigner
- [x] Replace emoji indicators (🔑) with text indicators (PK) in DataModelDesigner

> **Phases 2-4** are now the **🔴 P0 priority** — see [N.2 Designer Completion](#n2-designer-completion--p0-q2q3-2026) below.

**Phase 2: Interaction Layer (Next Sprint)** → 🔴 P0 — tracked in N.2

**Phase 3: Advanced Features (Q2 2026)** → 🔴 P0 — tracked in N.2

**Phase 4: Collaboration Integration (Q3 2026)** → 🔴 P0 — tracked in N.2

**Q2 Milestone:**
- **v1.0.0 Release (June 2026):** Full interactive experience — DnD, gestures, focus, animation, notifications, view enhancements
- **Spec compliance: 86% → 96%**

---

### 🚀 Console v1.0 Production Release (Feb 2026)

**Goal:** Ship an extremely optimized Console build — the official ObjectStack management UI — ready for production deployment. Reduce initial load, enable caching, and validate production readiness.

#### C.1 Bundle Optimization ✅ Complete
**Target:** Split monolithic 3.7 MB main chunk into cacheable, parallel-loadable pieces

- [x] Implement `manualChunks` strategy — 17 granular chunks (vendor-react, vendor-radix, vendor-icons, vendor-ui-utils, vendor-objectstack, vendor-zod, vendor-msw, vendor-charts, vendor-dndkit, vendor-i18n, framework, ui-components, ui-layout, infrastructure, plugins-core, plugins-views, data-adapter)
- [x] Main entry chunk reduced from 1,008 KB gzip → 48.5 KB gzip (**95% reduction**)
- [x] Vendor chunks enable long-term browser caching (react, radix, icons rarely change)
- [x] Plugin chunks (charts, kanban, markdown, map) load on demand — not in critical path
- [x] Disable production source maps (`sourcemap: false`) for smaller output

**Before / After (gzip):**
| Chunk | Before | After |
|-------|--------|-------|
| Main entry (index.js) | 1,008 KB | 48.5 KB |
| React vendor | (bundled) | 73.9 KB |
| Radix UI | (bundled) | 56.6 KB |
| UI components | (bundled) | 111.9 KB |
| Framework | (bundled) | 17.1 KB |
| ObjectStack SDK | (bundled) | 282.8 KB |
| Icons | (bundled) | 165.7 KB |
| MSW (demo mode) | (bundled) | 82.5 KB (excluded in server mode) |

#### C.2 Compression ✅ Complete
**Target:** Pre-compressed assets for instant serving

- [x] Add Gzip pre-compression via `vite-plugin-compression2` (threshold: 1 KB)
- [x] Add Brotli pre-compression for modern browsers (20-30% smaller than Gzip)
- [x] All 40+ JS/CSS assets pre-compressed at build time
- [x] Brotli main entry: **40 KB** (vs 48.5 KB Gzip)

#### C.3 MSW Production Separation ✅ Complete
**Target:** Zero mock-server overhead in production builds

- [x] Lazy-load MSW via `await import('./mocks/browser')` — dynamic import instead of static
- [x] `build:server` mode fully excludes MSW from bundle (~150 KB gzip saved)
- [x] Demo mode (`build`) still includes MSW as a lazy chunk for showcase deployments
- [x] `VITE_USE_MOCK_SERVER=false` dead-code eliminates MSW import at build time

#### C.4 Bundle Analysis ✅ Complete
**Target:** Ongoing bundle size monitoring

- [x] Add `rollup-plugin-visualizer` — generates interactive treemap at `dist/stats.html`
- [x] Add `build:analyze` npm script for quick analysis
- [x] Gzip and Brotli size reporting in visualizer output

#### C.5 Production Hardening ✅ Complete
**Target:** Production-grade deployment readiness

- [x] Add Content Security Policy (CSP) meta tags in index.html
- [x] Add resource preload hints (`<link rel="modulepreload">`) for critical chunks
- [x] Configure Cache-Control headers documentation for deployment
- [x] Add error tracking integration (Sentry/equivalent) setup guide
- [x] Performance budget CI check (fail build if main entry > 60 KB gzip)

**Console v1.0 Milestone:**
- **Production build:** Main entry 48.5 KB gzip, total initial load ~308 KB gzip (Brotli: ~250 KB)
- **Server mode:** MSW excluded, ObjectStack SDK + framework only
- **Caching:** 17 vendor chunks with content-hash filenames for immutable caching
- **Compression:** Gzip + Brotli pre-compressed, zero runtime compression overhead

---

### Q3 2026: Enterprise & Offline (Jul-Sep)

**Goal:** Offline-first architecture, real-time collaboration, performance optimization, page transitions

#### 3.1 Offline & Sync Support (4 weeks)
**Target:** Offline-first architecture with conflict resolution

- [x] Implement OfflineConfigSchema-based offline mode detection and fallback — `useOffline` hook
- [x] Implement SyncConfigSchema for background data synchronization — `useOffline` with auto-sync on reconnect
- [x] Implement ConflictResolutionSchema strategies (last-write-wins, manual merge, server-wins) — configurable via `sync.conflictResolution`
- [x] Implement EvictionPolicySchema for cache management (LRU, TTL, size-based) — configurable via `cache.evictionPolicy`
- [x] Implement PersistStorageSchema for IndexedDB/localStorage persistence — localStorage queue persistence
- [x] Integrate with @objectstack/client ETag caching and Service Worker — `useETagCache` hook with ETag-aware fetch, LRU cache, Service Worker registration
- [x] Add offline indicator UI with sync status — `showIndicator` + `offlineMessage` in `useOffline`

**Spec Reference:** `OfflineConfigSchema`, `OfflineCacheConfigSchema`, `OfflineStrategySchema`, `SyncConfigSchema`, `ConflictResolutionSchema`, `PersistStorageSchema`, `EvictionPolicySchema`

#### 3.2 Real-time Collaboration (4 weeks)
**Target:** Multi-user real-time editing and presence

- [x] Integrate `client.realtime.*` WebSocket API for live data subscriptions — `useRealtimeSubscription` hook in @object-ui/collaboration
- [x] Live cursors and presence indicators — `LiveCursors`, `PresenceAvatars`, `usePresence` in @object-ui/collaboration
- [x] Comment threads and @mentions — `CommentThread` component in @object-ui/collaboration
- [x] Conflict resolution with version history — `useConflictResolution` hook in @object-ui/collaboration
- [x] Complete CollaborationProvider in plugin-designer — enhanced with WebSocket transport, presence tracking, version counting

**Deliverables:**
- @object-ui/collaboration package

#### 3.3 Performance Optimization (3 weeks)
**Target:** Implement PerformanceConfigSchema monitoring

- [x] Implement PerformanceConfigSchema runtime (LCP, FCP, TTI tracking) — `usePerformance` hook with Web Vitals
- [x] Add performance budget enforcement (bundle size, render time thresholds) — `usePerformanceBudget` hook with violation tracking and dev-mode warnings
- [x] Optimize lazy loading with route-based code splitting — Console app uses `React.lazy()` + `Suspense` for auth, admin, detail, dashboard, and designer routes; `manualChunks` splits 3.7 MB bundle into 17 cacheable chunks
- [x] Add performance dashboard in console (dev mode) — `PerformanceDashboard` floating panel with LCP, FCP, memory, render count, budget violations (Ctrl+Shift+P toggle)
- [x] Target: main entry < 50 KB gzip, initial load ~308 KB gzip — achieved via `manualChunks` + Gzip/Brotli compression

**Spec Reference:** `PerformanceConfigSchema`

#### 3.4 Page Transitions (2 weeks)
**Target:** Smooth page and view transitions

- [x] Implement PageTransitionSchema for route-level transitions (fade, slide, scale) — `usePageTransition` hook (9 transition types)
- [x] Consume PageComponentType for page variant resolution — types re-exported from @object-ui/types
- [x] Add view transition animations between view types (grid ↔ kanban ↔ calendar) — `ViewSwitcher` enhanced with `animated` prop and `document.startViewTransition()` integration
- [x] Integrate with browser View Transitions API where supported — `useViewTransition` hook with native API support, CSS fallback, and reduced-motion awareness

**Spec Reference:** `PageTransitionSchema`, `PageComponentType`

#### 3.5 Plugin Marketplace (6 weeks) → 🟡 P1 — tracked in N.3

- [ ] Plugin marketplace website → see [N.3 Ecosystem & Marketplace](#n3-ecosystem--marketplace--p1-q3-2026)
- [ ] Plugin publishing platform → see N.3
- [x] Plugin development guide with template generator
- [ ] 25+ official plugins → see N.3

#### 3.6 Community Building (Ongoing) → 🟡 P1 — tracked in N.4

- [ ] Official website (www.objectui.org) → see [N.4 Community Growth](#n4-community-growth--p1-ongoing-starts-q2-2026)
- [ ] Discord community → see N.4
- [ ] Monthly webinars and technical blog → see N.4
- [ ] YouTube tutorial series → see N.4

**Q3 Milestone:**
- **v1.5.0 Release (September 2026):** Offline-first, real-time, performance-optimized
- **Spec compliance: 96% → 100%**
  - 30+ plugins
  - 5,000+ GitHub stars
  - 1,000+ community members

---

### 🔮 Current Priority: v3.0.0 Deep Integration & 2027 Vision

> **Status:** 🚀 Active — All Q1–Q3 foundation work and Console v1.0 are complete. This section is now the **primary development focus**.

**Goal:** Leverage @objectstack/spec v3.0.0 consolidation for deeper platform integration, complete designer tooling, and prepare for 2027 growth.

#### N.1 v3.0.0 Deep Integration — 🔴 P0 (Immediate, Q2 2026)
**Target:** Full adoption of v3.0.0 consolidated namespaces and APIs

> **Why P0:** The foundation for all downstream work. Ensures full spec compliance before designer, marketplace, and cloud features can ship safely.

- [ ] Adopt `Cloud` namespace (replacing `Hub`) for cloud deployment, hosting, and marketplace schemas
- [ ] Integrate `./contracts` module for plugin contract validation and marketplace publishing
- [ ] Integrate `./integration` module for third-party service connectors (Slack, email, webhooks)
- [ ] Integrate `./security` module for advanced security policies (CSP config, audit logging, data masking)
- [ ] Adopt `./studio` module schemas for visual designer improvements (canvas, property editors, theme builder)
- [ ] Migrate all data consumers to v3.0.0 `PaginatedResult` API (`records`/`total`/`hasMore`)
- [ ] Update ObjectStackAdapter to use v3.0.0 metadata API patterns (`getItem`/`getItems`/`getCached`)
- [ ] Add v3.0.0 compatibility tests for all 13 package.json @objectstack dependencies

**Milestone:** 100% @objectstack/spec v3.0.0 compliance verified across all packages

#### N.2 Designer Completion — 🔴 P0 (Q2–Q3 2026)
**Target:** Enterprise-quality visual designer experience

> **Why P0:** Designers are the primary user-facing feature gap. Completing phases 2–4 unlocks the visual development story for enterprise customers.

**Phase 2: Interaction Layer (Immediate — Next Sprint)**
- [ ] Implement drag-and-drop for component/entity/node positioning using @dnd-kit
- [ ] Implement undo/redo using command pattern with state history
- [ ] Add confirmation dialogs for destructive delete actions
- [ ] Implement edge creation UI in ProcessDesigner (click-to-connect nodes)
- [ ] Add inline entity field editing in DataModelDesigner

**Phase 3: Advanced Features (Q2 2026)**
- [ ] Full property editors with live preview for all designers
- [ ] i18n integration for all hardcoded UI strings via resolveI18nLabel
- [ ] Canvas pan/zoom with minimap for DataModelDesigner and ProcessDesigner
- [ ] Auto-layout algorithms for entity and node positioning
- [ ] Copy/paste support (Ctrl+C/V) across all designers
- [ ] Multi-select and bulk operations
- [ ] Responsive/collapsible panel layout

**Phase 4: Collaboration Integration (Q3 2026)**
- [ ] Wire CollaborationProvider into each designer for real-time co-editing
- [ ] Live cursor positions on shared canvases
- [ ] Operation-based undo/redo synchronized across collaborators
- [ ] Conflict resolution UI for concurrent edits
- [ ] Version history browser with visual diff

**Milestone:** All 5 designers (Page, View, DataModel, Process, Report) feature-complete with drag-and-drop, undo/redo, collaboration, and accessibility

#### N.3 Ecosystem & Marketplace — 🟡 P1 (Q3 2026)

> **Why P1:** Marketplace is the growth engine. Depends on N.1 (contracts module) and N.2 (designer maturity) for a credible launch.

- [ ] Plugin marketplace website with search, ratings, and install count
- [ ] Plugin publishing CLI (`objectui publish`) with automated validation
- [ ] 25+ official plugins (including AG Grid, ECharts, Monaco Editor, MapLibre)
- [ ] Plugin contract enforcement via `./contracts` module
- [ ] Official website (www.objectui.org) with interactive playground

**Milestone:** Public marketplace launch with 25+ searchable, installable plugins

#### N.4 Community Growth — 🟡 P1 (Ongoing, starts Q2 2026)

> **Why P1:** Community is essential for adoption and plugin ecosystem. Runs in parallel with N.1–N.3.

- [ ] Discord community with 1,000+ members
- [ ] Monthly webinars and technical blog posts
- [ ] YouTube tutorial series (10+ videos)
- [ ] Conference talks (React Summit, JSConf)
- [ ] Open-source contributor program

**Milestone:** 1,000+ Discord members, 10+ published content pieces, active contributor pipeline

#### N.5 2027 Vision: ObjectUI Platform — 🔵 P2 (Q4 2026 – 2027)

> **Why P2:** Strategic long-term bets. Planning starts Q3 2026; execution begins Q4 2026.

- [ ] ObjectUI Cloud v2.0 — multi-region, SOC2 compliance, 99.9% SLA
- [ ] AI-powered schema generation from natural language descriptions
- [ ] Visual theme marketplace (100+ community themes)
- [ ] ObjectUI Mobile — React Native renderer sharing the same JSON schemas
- [ ] Industry accelerators (CRM, ERP, HRM, e-commerce) as turnkey solutions
- [ ] Target: 10,000+ GitHub stars, 50,000+ NPM weekly downloads, $2M+ ARR

**Milestone:** Platform architecture defined, Cloud v2.0 alpha, Mobile renderer POC

---

### Q4 2026: Commercialization (Oct-Dec)

**Goal:** Launch ObjectUI Cloud and achieve commercial success

> **Note:** Q4 items depend on successful completion of N.1–N.3. N.5 platform work runs in parallel.

#### 4.1 ObjectUI Cloud (8 weeks)

- [ ] Project hosting and online editor
- [ ] Database as a Service
- [ ] One-click deployment
- [ ] Performance monitoring and alerts
- [ ] Billing system (Free, Pro $49/mo, Enterprise $299/mo)

#### 4.2 Industry Solutions (Ongoing)

- [ ] CRM System
- [ ] ERP System
- [ ] HRM System
- [ ] E-commerce Backend
- [ ] Project Management

#### 4.3 Partner Ecosystem (Ongoing)

- [ ] Technology partnerships (AWS, Alibaba Cloud, MongoDB)
- [ ] Channel partnerships (system integrators, consulting firms)
- [ ] 10+ strategic partners

**Q4 Milestone:**
- **v2.0.0 Release (December 2026):** Commercial Success
  - 100% @objectstack/spec v3.0.0 compliance verified
  - 1,000+ cloud users
  - 50+ enterprise customers
  - $500K annual revenue

---

## 📈 2026 Annual Targets

| Metric | Q1 ✅ | Q2 (N.1–N.2) | Q3 (N.2–N.4) | Q4 (N.5 + Cloud) |
|--------|-------|---------------|---------------|-------------------|
| **Test Coverage** | 80% | 85% | 90% | 90% |
| **Spec Compliance (v3.0.0)** | 86% | 100% ← N.1 | 100% | 100% |
| **Client Integration** | 100% | 100% | 100% | 100% |
| **Performance (LCP)** | 0.6s | 0.5s | 0.5s | 0.4s |
| **Designer Completion** | Phase 1 ✅ | Phase 2–3 ← N.2 | Phase 4 ← N.2 | Stable |
| **GitHub Stars** | 1K | 2.5K | 5K | 10K |
| **NPM Downloads/week** | 5K | 10K | 20K | 50K |
| **Plugins** | 20 | 25 ← N.3 | 30 ← N.3 | 35 |
| **Community (Discord)** | — | 200 ← N.4 | 500 ← N.4 | 1,000 |
| **Enterprise Customers** | — | 5 | 25 | 50 |
| **Annual Revenue** | — | — | $100K | $500K |

---

## 💰 Resource Requirements

### Team Structure (15 people)
- Senior Full-Stack Engineer: 3
- Frontend Engineer: 4
- Backend Engineer: 2
- QA Engineer: 2
- DevOps Engineer: 1
- Technical Writer: 1
- Product Manager: 1
- UI/UX Designer: 1

### Budget (12 months)
- Personnel: $1,200,000
- Infrastructure: $60,000
- Tools & Software: $30,000
- Marketing: $140,000
- Contingency (10%): $143,000
- **Total: $1,573,000**

### Expected ROI
- Year 1 Revenue: $550K
- Year 2 Revenue: $2.2M

---

## ⚠️ Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Spec Changes (post v3.0.0) | Medium | High | Regular sync with ObjectStack team; strict "import, never redefine" rule ensures type-level updates propagate automatically |
| Performance Regression | Medium | Medium | PerformanceConfigSchema monitoring, performance budgets, CI benchmarks |
| Security Vulnerabilities | Low | High | Security audits, bug bounty, WCAG compliance, CSP headers |
| Offline/Sync Complexity | Medium | High | Incremental rollout (read-only cache → full sync); ConflictResolutionSchema strategies |
| Competition | High | Medium | Differentiation via spec compliance + Shadcn quality; rapid iteration |
| Low Adoption | Medium | High | Enhanced marketing, lower barriers, plugin marketplace |
| v3.0.0 Type Surface Area | Low | Medium | Phased implementation (Q1: accessibility/i18n, Q2: interactive, Q3: offline/perf) |

---

## 📚 Reference Documents

- [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) — Per-package @objectstack/spec v3.0.0 compliance evaluation (98% current, prioritized roadmap)
- [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — @objectstack/client v3.0.0 evaluation (100% protocol coverage, 13/13 API namespaces, 95+ methods)
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Quick reference for developers

---

## 🎯 Getting Involved

### For Contributors
- Review [CONTRIBUTING.md](./CONTRIBUTING.md)
- Join our [Discord](https://discord.gg/objectui)
- Check [Good First Issues](https://github.com/objectstack-ai/objectui/labels/good%20first%20issue)

### For Enterprise Users
- Explore [Enterprise Services](https://www.objectui.org/enterprise)
- Request a demo: hello@objectui.org

### For Plugin Developers
- Read [Plugin Development Guide](./content/docs/guide/plugin-development.mdx)
- Submit plugins to the marketplace

---

**Roadmap Status:** 🔮 Active — v3.0.0 Deep Integration & 2027 Vision (N.1–N.5) in progress  
**Next Review:** March 15, 2026  
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
