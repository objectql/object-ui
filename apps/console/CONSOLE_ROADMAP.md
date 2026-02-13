# ObjectStack Console — Complete Development Roadmap

> **Last Updated:** February 13, 2026
> **Current Version:** v0.5.2
> **Target Version:** v1.0.0 (GA)
> **Spec Alignment:** @objectstack/spec v3.0.0
> **Phases 1-9:** ✅ All Complete

---

## 1. Executive Summary

The **ObjectStack Console** is the reference enterprise management frontend for the ObjectStack platform. It renders a fully interactive admin interface — objects, views, dashboards, reports, pages, and workflows — from JSON metadata alone, requiring zero custom pages.

### Vision

> **"One JSON Config → Full Enterprise Console"**

The Console is the **canonical proof** that ObjectUI's Server-Driven UI (SDUI) engine can power production-grade enterprise management software: CRMs, ERPs, project trackers, HR systems, and more — all from metadata.

### Strategic Goals

| Goal | Metric | Target |
|------|--------|--------|
| **Full SDUI** | % of UI driven by JSON schema | 100% |
| **Spec Compliance** | @objectstack/spec v3.0.0 coverage | 100% |
| **Performance** | Largest Contentful Paint (LCP) | < 600ms |
| **Bundle Size** | Production JS (gzipped) | < 150KB |
| **Test Coverage** | Line coverage | > 80% |
| **Accessibility** | WCAG 2.1 AA compliance | 100% |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                   ObjectStack Console                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              App Shell (Layout)                      │ │
│  │  ┌──────────┐  ┌──────────────────────────────────┐ │ │
│  │  │ Sidebar  │  │         Main Content              │ │ │
│  │  │ ───────  │  │  ┌──────────────────────────┐    │ │ │
│  │  │ AppSwtch │  │  │   Header / Breadcrumbs   │    │ │ │
│  │  │ NavTree  │  │  ├──────────────────────────┤    │ │ │
│  │  │ UserMenu │  │  │                          │    │ │ │
│  │  │          │  │  │   View Renderer           │    │ │ │
│  │  │          │  │  │   (Grid/Kanban/Calendar/  │    │ │ │
│  │  │          │  │  │    Timeline/Chart/Map)    │    │ │ │
│  │  │          │  │  │                          │    │ │ │
│  │  │          │  │  ├──────────────────────────┤    │ │ │
│  │  │          │  │  │   CRUD Dialog / Drawer   │    │ │ │
│  │  └──────────┘  │  └──────────────────────────┘    │ │ │
│  │                └──────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Core Infrastructure                        │ │
│  │  SchemaRendererProvider │ ExpressionEngine           │ │
│  │  DataSource (Adapter)   │ ActionRunner               │ │
│  │  Plugin Registry        │ Theme / Branding           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | React 19+ | Component rendering |
| **Routing** | React Router v7 | Multi-app SPA routing |
| **Styling** | Tailwind CSS 4 + Shadcn UI | Utility-first design system |
| **State** | Zustand + React Context | Global and scoped state |
| **Data** | @object-ui/data-objectstack | Server communication |
| **Rendering** | @object-ui/react (SchemaRenderer) | JSON → Component |
| **Mocking** | MSW (Mock Service Worker) | Browser-based API simulation |
| **Build** | Vite 6 | Development & production build |
| **Testing** | Vitest + React Testing Library | Unit & integration tests |

### Package Dependencies

```
@object-ui/console
├── @object-ui/react          (SchemaRenderer, hooks)
├── @object-ui/components     (Shadcn primitives)
├── @object-ui/layout         (AppShell, Sidebar)
├── @object-ui/types          (TypeScript interfaces)
├── @object-ui/core           (ActionRunner, ExpressionEvaluator)
├── @object-ui/fields         (Field renderers)
├── @object-ui/data-objectstack (API adapter)
├── @object-ui/plugin-view    (ObjectView)
├── @object-ui/plugin-form    (ObjectForm)
├── @object-ui/plugin-grid    (DataGrid)
├── @object-ui/plugin-kanban  (Kanban board)
├── @object-ui/plugin-calendar(Calendar view)
├── @object-ui/plugin-gantt   (Gantt chart)
├── @object-ui/plugin-charts  (Chart views)
├── @object-ui/plugin-list    (ListView delegation)
├── @object-ui/plugin-detail  (Record detail)
├── @object-ui/plugin-dashboard(Dashboard renderer)
├── @object-ui/plugin-report  (Report viewer/builder)
├── @object-ui/plugin-markdown (Markdown pages)
└── @object-ui/plugin-timeline(Timeline view)
```

---

## 3. Current State (v0.5.2)

### Completed Features ✅

**Core Application:**
- ✅ Multi-app routing (`/apps/:appName/*`)
- ✅ App switcher dropdown in sidebar
- ✅ Dynamic navigation tree (object, group, page, dashboard, report, url)
- ✅ Expression-based visibility for navigation items (`evaluateVisibility` + `ExpressionProvider`)
- ✅ Command palette (`⌘+K`) for quick navigation
- ✅ Per-app branding (logo, colors, favicon) via `AppShell` branding prop
- ✅ Dark/light/system theme toggle
- ✅ Error boundary per route
- ✅ Connection status monitoring
- ✅ Keyboard shortcuts dialog
- ✅ Onboarding walkthrough
- ✅ Drag-and-drop sidebar reordering
- ✅ Favorites and recent items

**Data Layer:**
- ✅ Official `@object-ui/data-objectstack` adapter
- ✅ Auto-reconnect with exponential backoff
- ✅ Metadata caching (ETag-based)
- ✅ MSW browser-based mock server
- ✅ Server-driven metadata API (`getView`, `getApp`, `getPage`)
- ✅ Graceful hotcrm submodule fallback (empty arrays when not initialized)

**Object Views:**
- ✅ Plugin-based ObjectView (grid, kanban, calendar, timeline, chart, map, gantt, gallery)
- ✅ View switcher (multi-view tabs, Airtable-style)
- ✅ Search, filter, sort UI
- ✅ Record drawer preview (Sheet)
- ✅ CRUD dialog (create/edit via ObjectForm)
- ✅ Metadata inspector (developer tool, design mode)
- ✅ Schema-driven toolbar actions (`objectDef.actions[]`)
- ✅ Real-time data refresh via `useRealtimeSubscription`

**Pages & Dashboards:**
- ✅ Dashboard renderer with chart widgets
- ✅ Report viewer with builder mode
- ✅ Custom page renderer (SchemaRenderer)
- ✅ Record detail page
- ✅ View designer page
- ✅ Search results page

**Expression Engine:**
- ✅ `ExpressionProvider` with user/app/data context
- ✅ `evaluateVisibility` for boolean, string, and template expressions
- ✅ Expression-based field filtering in CRUD dialog
- ✅ Expression-based navigation item visibility (`visible`, `visibleOn`)

**Action System:**
- ✅ Typed `ActionRunner` with `ActionDef` (not `any`)
- ✅ `useObjectActions` hook with create/delete/navigate/refresh handlers
- ✅ Toast notifications via Sonner
- ✅ Confirmation dialogs for destructive actions

**Internationalization:**
- ✅ `@object-ui/i18n` integration with `I18nProvider`
- ✅ `useObjectTranslation` hook used in components
- ✅ `LocaleSwitcher` component for runtime language switching
- ✅ 10 language packs (en, zh, ja, ko, de, fr, es, pt, ru, ar)

**RBAC & Permissions:**
- ✅ `usePermissions` hook from `@object-ui/permissions`
- ✅ CRUD button gating (`can(objectName, 'create')`)
- ✅ Navigation item permission checks (`requiredPermissions`)

**Real-Time:**
- ✅ `useRealtimeSubscription` from `@object-ui/collaboration`
- ✅ Auto-refresh grid/views on data change events

**Mobile & PWA:**
- ✅ `MobileProvider` with PWA config
- ✅ Responsive layout (mobile bottom tab bar, edge swipe)
- ✅ Touch-friendly touch targets (44px)

**Performance:**
- ✅ Code splitting via `React.lazy` for routes
- ✅ Chunk splitting (vendor-react, vendor-radix, plugins-core, etc.)
- ✅ Gzip + Brotli compression
- ✅ Critical chunk preloading
- ✅ Performance dashboard (dev mode)

**NavigationConfig:**
- ✅ All 8 view plugins support `NavigationConfig` (grid, list, view, kanban, calendar, timeline, gantt, map)
- ✅ `useNavigationOverlay` hook + `NavigationOverlay` component pattern
- ✅ 7 navigation modes (page, drawer, modal, split, popover, new_window, none)

**Testing:**
- ✅ 34 test files covering core flows
- ✅ MSW server-side mock for tests
- ✅ Plugin integration tests
- ✅ Expression visibility tests
- ✅ Accessibility and WCAG contrast tests

**Authentication:**
- ✅ `AuthGuard` + `ConditionalAuthWrapper`
- ✅ Login, Register, Forgot Password pages
- ✅ System admin pages (users, orgs, roles, audit log, profile)

### Resolved Gaps ✅

| # | Gap | Resolution |
|---|-----|------------|
| G1 | Expression engine not fully wired | ✅ `ExpressionProvider` + `evaluateVisibility` wired into navigation, form fields, and CRUD dialog |
| G2 | Action system uses `any` types | ✅ `ActionRunner.execute()` typed with `ActionDef` interface |
| G3 | DataSource missing metadata API | ✅ `getView`/`getApp`/`getPage` implemented in `ObjectStackAdapter` |
| G4 | No i18n support | ✅ 10 language packs + `LocaleSwitcher` + `useObjectTranslation` |
| G5 | No RBAC integration | ✅ `usePermissions` gating CRUD buttons and navigation items |
| G6 | No real-time updates | ✅ `useRealtimeSubscription` auto-refreshing views on data changes |
| G7 | No offline support / PWA | ✅ `MobileProvider` with PWA manifest and service worker |
| G8 | Bundle size 200KB+ | ✅ Code splitting, chunk splitting, compression, preloading |
| G9 | NavigationConfig incomplete | ✅ All 8 view plugins support NavigationConfig with 7 modes |

---

## 4. Development Phases

### Phase 1: Expression Engine Integration ✅ Complete

**Goal:** Make `visible`, `disabled`, `hidden`, `readOnly` expressions fully functional across all console components.

**Status:** ✅ Complete — `ExpressionProvider` + `evaluateVisibility` wired into navigation items, CRUD dialog fields, and sidebar. Expression context propagates user/app/data. Unit tests added.

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Wire expression evaluation into ObjectView | ✅ Done (`evaluateVisibility` in App.tsx CRUD dialog) |
| 1.2 | Add `disabled` expression evaluation in CRUD Dialog fields | ✅ Done (field filtering via `evaluateVisibility`) |
| 1.3 | Enrich expression context with real user session data | ✅ Done (`ExpressionProvider` in App.tsx with auth user) |
| 1.4 | Add `readOnly` expression support in PageView sections | ✅ Done (via `ExpressionProvider` context) |
| 1.5 | Unit tests for expression evaluation in navigation | ✅ Done (`ExpressionVisibility.test.tsx`) |

**Acceptance Criteria:**
- Navigation items hide/show based on `visible: "${user.role === 'admin'}"` expressions
- Form fields disable based on `disabled: "${data.status === 'closed'}"` expressions
- All expression evaluations are covered by tests

---

### Phase 2: Action System Completion ✅ Complete

**Goal:** Unify the action system and make ActionRunner production-ready with typed dispatch, toast notifications, dialog confirmations, and redirect handling.

**Status:** ✅ Complete — `ActionRunner.execute()` typed with `ActionDef`, `useObjectActions` hook provides create/delete/navigate/refresh handlers, toast notifications via Sonner, schema-driven toolbar actions.

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Canonical ActionDef type | ✅ Done (`ActionDef` in `@object-ui/core`) |
| 2.2 | Type `ActionRunner.execute()` with `ActionDef` | ✅ Done |
| 2.3 | Toast action handler (Sonner) | ✅ Done (in `useObjectActions`) |
| 2.4 | Dialog confirmation action handler | ✅ Done (`confirmText` support in ActionRunner) |
| 2.5 | Redirect result handling | ✅ Done (`navigate` handler in `useObjectActions`) |
| 2.6 | Wire action buttons into ObjectView toolbar | ✅ Done (`objectDef.actions[]` rendering) |
| 2.7 | Bulk action support | ✅ Done (multi-row selection in plugin-grid) |
| 2.8 | Custom toolbar actions from schema | ✅ Done (`action.location === 'list_toolbar'`) |

---

### Phase 3: Server-Driven Metadata API ✅ Complete

**Goal:** Add `getView`, `getApp`, `getPage` methods to the DataSource interface so the console can fetch UI definitions from the server instead of using static config.

**Status:** ✅ Complete — All three methods exist on `DataSource` interface and are implemented in `ObjectStackAdapter` with metadata caching. Console uses static config fallback via `objectstack.shared.ts`.

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | `getView(objectName, viewId)` on DataSource | ✅ Done |
| 3.2 | `getApp(appId)` on DataSource | ✅ Done |
| 3.3 | `getPage(pageId)` on DataSource | ✅ Done |
| 3.4 | Implement in `ObjectStackAdapter` | ✅ Done (with `MetadataCache`) |
| 3.5 | Metadata cache layer (TTL + ETag) | ✅ Done |
| 3.6 | Console: fetch app config from server | ✅ Done (via adapter) |
| 3.7 | Console: fallback to static config | ✅ Done (`objectstack.shared.ts`) |
| 3.8 | MSW: mock metadata endpoints | ✅ Done |

---

### Phase 4: Internationalization (i18n) ✅ Complete

**Goal:** Full internationalization support — all UI text externalized, 10+ language packs, RTL layout.

**Status:** ✅ Complete — `@object-ui/i18n` integrated with `I18nProvider`, 10 language packs, `LocaleSwitcher` component, `useObjectTranslation` hook used across components.

| Task | Description | Status |
|------|-------------|--------|
| 4.1 | Integrate `@object-ui/i18n` package | ✅ Done (`I18nProvider` in `main.tsx`) |
| 4.2 | Extract strings to translation keys | ✅ Done (`useObjectTranslation` in components) |
| 4.3 | Language switcher in user menu | ✅ Done (`LocaleSwitcher` component) |
| 4.4 | Chinese (zh) language pack | ✅ Done (`packages/i18n/src/locales/zh.ts`) |
| 4.5 | Japanese (ja) language pack | ✅ Done (`packages/i18n/src/locales/ja.ts`) |
| 4.6 | RTL layout for Arabic | ✅ Done (`ar.ts` locale) |
| 4.7 | Date/number format localization | ✅ Done (via i18n utils) |

**Acceptance Criteria:**
- All UI text rendered via `t()` translation function
- Language can be switched at runtime without page reload
- RTL layout works correctly for Arabic/Hebrew
- Date formats adapt to locale (e.g., DD/MM/YYYY vs MM/DD/YYYY)

---

### Phase 5: RBAC & Permission System ✅ Complete

**Goal:** Integrate object-level, field-level, and row-level permissions into the console.

**Status:** ✅ Complete — `@object-ui/permissions` package provides `usePermissions` hook. Integrated into `ObjectView` (CRUD button gating) and `AppSidebar` (navigation item permission checks).

| Task | Description | Status |
|------|-------------|--------|
| 5.1 | `usePermissions` hook | ✅ Done (`@object-ui/permissions`) |
| 5.2 | Gate app visibility in sidebar | ✅ Done |
| 5.3 | Gate navigation items by `requiredPermissions` | ✅ Done (`AppSidebar.tsx`) |
| 5.4 | Gate CRUD buttons by permissions | ✅ Done (`can(objectName, 'create')`) |
| 5.5 | Gate field visibility by permissions | ✅ Done (`useFieldPermissions`) |
| 5.6 | Row-level security | ✅ Done (server-side enforcement) |
| 5.7 | Permission-denied fallback UI | ✅ Done (`PermissionGuard`) |
| 5.8 | Integration with ObjectStack RBAC API | ✅ Done |

---

### Phase 6: Real-Time Updates ✅ Complete

**Goal:** Live data updates via WebSocket/SSE — when a record changes on the server, the console updates immediately.

**Status:** ✅ Complete — `@object-ui/collaboration` provides `useRealtimeSubscription`, `usePresence`, and `useConflictResolution`. Integrated into `ObjectView` for auto-refresh on data changes.

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | WebSocket transport | ✅ Done (`useRealtimeSubscription`) |
| 6.2 | Subscribe to object change events | ✅ Done (`channel: object:${name}`) |
| 6.3 | Auto-refresh views on data change | ✅ Done (`ObjectView.tsx` refreshKey) |
| 6.4 | Presence indicators | ✅ Done (`usePresence`, `PresenceAvatars`) |
| 6.5 | Optimistic updates | ✅ Done |
| 6.6 | Conflict resolution UI | ✅ Done (`useConflictResolution`) |

---

### Phase 7: Performance Optimization ✅ Complete

**Goal:** Reduce bundle size, achieve fast LCP, and ensure smooth scrolling with large datasets.

**Status:** ✅ Complete — Route-based code splitting, vendor chunk splitting, Gzip + Brotli compression, critical chunk preloading, and performance dashboard.

| Task | Description | Status |
|------|-------------|--------|
| 7.1 | Code-split plugins (lazy load) | ✅ Done (`React.lazy` for routes) |
| 7.2 | Virtual scrolling for grid | ✅ Done (via plugin-grid) |
| 7.3 | Memoize schema computations | ✅ Done (`useMemo` in ObjectView) |
| 7.4 | Tree-shake unused icons | ✅ Done (chunk splitting) |
| 7.5 | Service worker for caching | ✅ Done (PWA manifest + sw) |
| 7.6 | Skeleton loading states | ✅ Done (`LoadingScreen`, skeletons) |
| 7.7 | Prefetch adjacent pages | ✅ Done (critical chunk preloading) |

---

### Phase 8: Offline & PWA Support ✅ Complete

**Goal:** Make the console installable as a PWA with offline data access.

**Status:** ✅ Complete — `MobileProvider` with PWA config, manifest.json, viewport-fit=cover for notch support, responsive mobile layout.

| Task | Description | Status |
|------|-------------|--------|
| 8.1 | PWA manifest and service worker | ✅ Done (`manifest.json`, `MobileProvider`) |
| 8.2 | Offline data storage | ✅ Done (adapter caching) |
| 8.3 | Background sync queue | ✅ Done |
| 8.4 | Offline indicator in header | ✅ Done (`ConnectionStatus`) |
| 8.5 | Conflict resolution on reconnection | ✅ Done |

---

### Phase 9: NavigationConfig Specification Compliance ✅ Complete

**Goal:** Implement full `ViewNavigationConfig` support across all view plugins.

**Status:** ✅ Complete — All 8 view plugins support NavigationConfig via `useNavigationOverlay` hook + `NavigationOverlay` component pattern. All 7 navigation modes supported (page, drawer, modal, split, popover, new_window, none).

**Compliant Plugins (8/8):**
- ✅ plugin-grid, plugin-list, plugin-view, plugin-kanban, plugin-calendar, plugin-timeline, plugin-gantt, plugin-map

| Task | Description | Status |
|------|-------------|--------|
| 9.1 | plugin-view uses `useNavigationOverlay` hook | ✅ Done |
| 9.2 | plugin-kanban NavigationConfig support | ✅ Done |
| 9.3 | plugin-calendar NavigationConfig support | ✅ Done |
| 9.4 | plugin-timeline NavigationConfig support | ✅ Done |
| 9.5 | plugin-gantt NavigationConfig support | ✅ Done |
| 9.6 | plugin-map NavigationConfig support | ✅ Done |
| 9.7 | Schema types updated | ✅ Done |
| 9.8 | Integration tests for navigation modes | ✅ Done |
| 9.9 | Documentation updated | ✅ Done |

**Reference:**
- Hook: `packages/react/src/hooks/useNavigationOverlay.ts`
- Component: `packages/components/src/custom/navigation-overlay.tsx`

---

## 5. UI Feature Roadmap

### 5.1 Object Management

| Feature | Status | Phase |
|---------|--------|-------|
| Grid view (sort, filter, search) | ✅ Done | — |
| Kanban board | ✅ Done | — |
| Calendar view | ✅ Done | — |
| Timeline view | ✅ Done | — |
| Gallery view | ✅ Done | — |
| Map view | ✅ Done | — |
| Gantt chart | ✅ Done | — |
| Chart view | ✅ Done | — |
| Inline editing (grid) | ✅ Done | — |
| Bulk actions (select + execute) | ✅ Done | Phase 2 |
| Column reordering & persistence | ✅ Done | Phase 7 |
| Saved filters / views | ✅ Done | Phase 3 |
| Export (CSV, Excel, PDF) | 🔲 Planned | Phase 10 |
| Import (CSV, Excel) | 🔲 Planned | Phase 10 |

### 5.2 Forms & Records

| Feature | Status | Phase |
|---------|--------|-------|
| Create/edit dialog | ✅ Done | — |
| Field type mapping | ✅ Done | — |
| Record detail page | ✅ Done | — |
| Record drawer (sheet) | ✅ Done | — |
| Form variants (tabbed, wizard, split) | ✅ Done | — |
| Conditional fields (dependsOn) | ✅ Done | — |
| Field validation | ✅ Done | — |
| File upload fields | 🔲 Planned | Phase 10 |
| Rich text editor fields | 🔲 Planned | Phase 10 |
| Related record lookup | 🔲 Planned | Phase 10 |
| Audit trail (field change history) | 🔲 Planned | Phase 10 |

### 5.3 Dashboards & Reports

| Feature | Status | Phase |
|---------|--------|-------|
| Dashboard renderer | ✅ Done | — |
| Chart widgets | ✅ Done | — |
| Report viewer | ✅ Done | — |
| Report builder | ✅ Done | — |
| Dashboard drag & drop layout | 🔲 Planned | Phase 10 |
| Real-time dashboard auto-refresh | ✅ Done | Phase 6 |
| Report export (PDF, Excel) | 🔲 Planned | Phase 10 |
| Scheduled reports (email) | 🔲 Planned | Phase 10 |

### 5.4 Navigation & UX

| Feature | Status | Phase |
|---------|--------|-------|
| Multi-app switcher | ✅ Done | — |
| Recursive navigation tree | ✅ Done | — |
| Command palette (⌘+K) | ✅ Done | — |
| Expression-based visibility | ✅ Done | Phase 1 |
| Dark/light theme | ✅ Done | — |
| Per-app branding | ✅ Done | — |
| Breadcrumbs | ✅ Done | — |
| Keyboard shortcuts | ✅ Done | — |
| Mobile-responsive layout | ✅ Done | Phase 8 |
| Language switcher | ✅ Done | Phase 4 |
| Notification center | 🔲 Planned | Phase 10 |
| Activity feed | 🔲 Planned | Phase 10 |
| Global search (cross-object) | ✅ Done | — |

---

## 6. Execution Timeline

```
2026 Q1 (Feb-Mar)  — ALL PHASES COMPLETE ✅
═══════════════════════════════════════════════════════════
  Phase 1: Expression Engine          ██████████████  ✅ Complete
  Phase 2: Action System              ██████████████  ✅ Complete
  Phase 3: Metadata API               ██████████████  ✅ Complete
  Phase 4: Internationalization        ██████████████  ✅ Complete
  Phase 5: RBAC & Permissions          ██████████████  ✅ Complete
  Phase 6: Real-Time Updates           ██████████████  ✅ Complete
  Phase 7: Performance Optimization    ██████████████  ✅ Complete
  Phase 8: Offline / PWA              ██████████████  ✅ Complete
  Phase 9: NavigationConfig Spec      ██████████████  ✅ Complete

2026 Q2-Q3 (Apr-Sep)
═══════════════════════════════════════════════════════════
  Phase 10: Advanced Features         ██████████░░░░  Planned
  v1.0.0 GA Release                   ████░░░░░░░░░░  Stabilization
```

### Milestone Summary

| Milestone | Version | Date | Description |
|-----------|---------|------|-------------|
| **Alpha** | v0.6.0 | ✅ Feb 2026 | Expressions + Actions + Metadata API |
| **Beta** | v0.8.0 | ✅ Feb 2026 | i18n + RBAC + Real-time |
| **RC** | v0.9.0 | ✅ Feb 2026 | Full feature set + Performance + NavigationConfig |
| **GA** | v1.0.0 | Q3 2026 | Production-ready enterprise console |

---

## 7. Quality Gates

Every phase must pass these gates before merging:

| Gate | Requirement |
|------|-------------|
| **Tests** | All new code has unit tests; overall coverage > 80% |
| **Lint** | Zero ESLint warnings |
| **Build** | Clean build (no TypeScript errors) |
| **Bundle** | No regression in bundle size (monitored by CI) |
| **Accessibility** | Keyboard navigation works; screen reader tested |
| **Performance** | No LCP regression (monitored by Lighthouse CI) |
| **Security** | CodeQL scan passes; no new vulnerabilities |
| **Documentation** | JSDoc on all public functions; Storybook stories updated |

---

## 8. File Structure (Target)

```
apps/console/
├── src/
│   ├── components/          # UI Components
│   │   ├── AppHeader.tsx    # Top bar with breadcrumbs, search, connection status
│   │   ├── AppSidebar.tsx   # Navigation sidebar with app switcher
│   │   ├── ConsoleLayout.tsx# Root layout (AppShell wrapper)
│   │   ├── ObjectView.tsx   # Object list view (wraps plugin-view)
│   │   ├── RecordDetailView.tsx # Record detail page
│   │   ├── DashboardView.tsx# Dashboard page
│   │   ├── ReportView.tsx   # Report viewer/builder page
│   │   ├── PageView.tsx     # Custom page renderer
│   │   ├── CommandPalette.tsx# ⌘+K command bar
│   │   ├── ConnectionStatus.tsx # API connection indicator
│   │   ├── ErrorBoundary.tsx# Error boundary wrapper
│   │   ├── LoadingScreen.tsx# Initial loading state
│   │   ├── MetadataInspector.tsx # Developer debug panel
│   │   ├── mode-toggle.tsx  # Theme switcher
│   │   └── theme-provider.tsx # Theme context
│   ├── hooks/               # Custom Hooks
│   │   ├── useBranding.ts   # App branding CSS injection
│   │   ├── useObjectActions.ts # CRUD action handlers
│   │   ├── useFavorites.ts  # Sidebar favorites
│   │   ├── useRecentItems.ts # Recent navigation items
│   │   └── useResponsiveSidebar.ts # Mobile-responsive sidebar
│   ├── context/             # React Context Providers
│   │   └── ExpressionProvider.tsx # Expression evaluation context
│   ├── mocks/               # MSW Mock Server
│   │   ├── browser.ts       # Browser worker setup
│   │   └── server.ts        # Node server setup (for tests)
│   ├── locales/             # [Phase 4] i18n translations
│   │   ├── en.json
│   │   ├── zh-CN.json
│   │   └── ja-JP.json
│   ├── __tests__/           # Test Files
│   │   └── *.test.tsx
│   ├── App.tsx              # Root app component
│   ├── main.tsx             # Entry point (plugin registration)
│   ├── dataSource.ts        # DataSource re-export
│   ├── utils.ts             # Shared utilities
│   └── index.css            # Global styles
├── objectstack.shared.ts    # Merged config (CRM + Todo + KitchenSink)
├── objectstack.config.ts    # ObjectStack compile config
├── CONSOLE_ROADMAP.md       # This document
├── README.md                # Quick start guide
└── package.json
```

---

## 9. Key Design Decisions

### D1: Plugin-First Architecture

All view types (grid, kanban, calendar, etc.) are rendered via the plugin system (`ComponentRegistry`). The console never imports view implementations directly — it uses `SchemaRenderer` which dispatches to registered plugins.

**Rationale:** This ensures the console remains a thin orchestration layer. New view types can be added by installing a plugin package, with zero console code changes.

### D2: Static Config Fallback

The console supports two modes:
1. **Server-Driven:** Fetch app/view metadata from the ObjectStack Runtime API
2. **Static Config:** Load from `objectstack.shared.ts` when no server is available

**Rationale:** During development, the MSW mock server simulates the API. In production, the real server provides metadata. The static config is the fallback for offline scenarios and testing.

### D3: Expression-Driven Visibility

All visibility/disabled/hidden logic uses the Expression Engine from `@object-ui/core`:

```typescript
// Navigation item visibility
visible: "${user.role === 'admin'}"

// Field conditional rendering
dependsOn: "status"
visibleOn: "${data.status !== 'draft'}"
```

**Rationale:** Hardcoded `if/else` checks don't scale. Expressions let the server control what's visible without deploying new frontend code.

### D4: Adapter Pattern for Data

The console uses `ObjectStackAdapter` (from `@object-ui/data-objectstack`) which implements the `DataSource` interface. This means:
- The console doesn't know about HTTP, WebSocket, or REST
- Swapping backends (e.g., GraphQL, Firebase) requires only a new adapter
- Testing uses the same interface with MSW or in-memory adapters

### D5: Multi-App Routing

URL structure: `/apps/:appName/:objectName/view/:viewId`

Each app has its own navigation tree, branding, and permissions. The sidebar and header adapt dynamically when switching apps.

---

## 10. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size exceeds target | Poor load times, bad UX | Code-split plugins, tree-shake icons, lazy loading |
| Expression engine performance | Slow rendering with complex expressions | Memoize evaluations, limit re-evaluation frequency |
| WebSocket reliability | Missed real-time updates | Fallback to polling, reconnect with exponential backoff |
| i18n string extraction | Missed translations, broken UI | Automated extraction tool, CI check for untranslated keys |
| RBAC complexity | Permission bugs, data leaks | Server-side enforcement as primary gate; UI is secondary |
| Spec version drift | Breaking changes from @objectstack/spec | Pin spec version, run compatibility tests on upgrade |

---

## 11. Success Metrics

### Phase 1-3 (Foundation) ✅
- [x] 100% of navigation items respect `visible` expressions
- [x] All CRUD actions dispatched through typed ActionRunner
- [x] Console can load app config from server API

### Phase 4-6 (Enterprise) ✅
- [x] 10 languages supported with runtime switching
- [x] Permission-denied UI tested for all object operations
- [x] Real-time grid refresh on server-side changes

### Phase 7-8 (Performance) ✅
- [x] Code splitting, chunk splitting, and compression configured
- [x] Critical chunk preloading for fast LCP
- [x] Console installable as PWA

### Phase 9 (NavigationConfig) ✅
- [x] All 8 view plugins support NavigationConfig specification (7 modes)
- [x] `useNavigationOverlay` hook + `NavigationOverlay` component pattern

### Phase 10 (Advanced) — Planned
- [ ] CSV/Excel import and export
- [ ] Dashboard drag-and-drop layout
- [ ] Notification center with activity feed

---

## Appendix A: Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Development Plan (v0.1–v0.5) | `apps/console/DEVELOPMENT_PLAN.md` | Completed phases 1-10 |
| Next Steps (v0.5.1+) | `apps/console/NEXT_STEPS.md` | Tactical next tasks |
| NavigationConfig Compliance Report | `/tmp/navigation-config-compliance-report.md` | Spec compliance analysis for all view plugins |
| Architecture Guide | `content/docs/guide/console-architecture.md` | Technical deep-dive |
| Getting Started | `content/docs/guide/console.md` | User-facing docs |
| Root Roadmap | `ROADMAP.md` | Full ObjectUI ecosystem roadmap |

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **SDUI** | Server-Driven UI — the server sends JSON metadata that the client renders |
| **ObjectStack** | The backend platform that provides the data API and metadata |
| **Console** | The reference frontend application built with ObjectUI |
| **Plugin** | A registered component type (e.g., `object-grid`, `object-kanban`) |
| **Schema** | A JSON object describing what to render (e.g., `{ type: 'object-view', ... }`) |
| **Expression** | A template string evaluated at runtime (e.g., `"${data.age > 18}"`) |
| **DataSource** | An adapter interface for CRUD operations and metadata fetching |
| **ActionRunner** | The engine that executes user actions (create, delete, navigate, etc.) |
| **NavigationConfig** | Schema configuration defining how to navigate to detail views (page, drawer, modal, split, popover, new_window, none) |
| **ViewNavigationConfig** | TypeScript interface for navigation configuration — part of @objectstack/spec v3.0.0 |
