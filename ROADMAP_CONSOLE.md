# ObjectStack Console — Complete Development Roadmap

> **Last Updated:** February 16, 2026
> **Current Version:** v0.5.2
> **Target Version:** v1.0.0 (GA)
> **Spec Alignment:** @objectstack/spec v3.0.2
> **Bootstrap (Phase 0):** ✅ Complete
> **Phases 1-9:** ⚠️ Mostly Complete (see verified status below)
> **Priority Focus:** 🎯 UI-essential features for v1.0 release

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
- ✅ Official `@object-ui/data-objectstack` adapter (`ObjectStackAdapter`)
- ✅ Auto-reconnect with exponential backoff
- ✅ Metadata caching (ETag-based)
- ✅ MSW browser-based mock server
- ⚠️ Metadata API (`getView`, `getApp`, `getPage`) exists on adapter but console still loads from static config
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
- ⚠️ `useObjectActions` hook with create/delete/navigate/refresh handlers (callback-based, not yet full `ActionEngine` dispatch)
- ✅ Toast notifications via Sonner
- ✅ Confirmation dialogs for destructive actions
- ❌ Declarative `ActionDef[]` event pipeline (events → ActionEngine) not yet implemented

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

### Resolved Gaps

| # | Gap | Status | Resolution |
|---|-----|--------|------------|
| G1 | Expression engine not fully wired | ✅ | `ExpressionProvider` + `evaluateVisibility` wired into navigation, form fields, and CRUD dialog |
| G2 | Action system uses `any` types | ⚠️ | `useObjectActions` hook typed, but no declarative `ActionEngine` pipeline yet |
| G3 | DataSource missing metadata API | ⚠️ | `getView`/`getApp`/`getPage` exist on adapter, but console still uses static config |
| G4 | No i18n support | ✅ | 10 language packs + `LocaleSwitcher` + `useObjectTranslation` |
| G5 | No RBAC integration | ✅ | `usePermissions` gating CRUD buttons and navigation items |
| G6 | No real-time updates | ✅ | `useRealtimeSubscription` auto-refreshing views on data changes |
| G7 | No offline support / PWA | ✅ | `MobileProvider` with PWA manifest and service worker |
| G8 | Bundle size 200KB+ | ✅ | Code splitting, chunk splitting, compression, preloading |
| G9 | NavigationConfig incomplete | ✅ | All 8 view plugins support NavigationConfig with 7 modes |

---

## 4. Development Phases

### Phase 0: Bootstrap & Foundation ✅ Complete

**Origin:** Consolidated from `DEVELOPMENT_PLAN.md` (10 sub-phases, Feb 7-13 2026).

These were the initial tasks to bring the console prototype to production-quality architecture.

| Sub-Phase | Description | Status | Notes |
|-----------|-------------|--------|-------|
| 0.1 | English-Only Codebase | ✅ Done | All Chinese strings replaced with English; i18n keys used |
| 0.2 | Plugin Registration | ✅ Done | 14 plugins registered in `main.tsx` (5 planned + 9 extra) |
| 0.3 | Config Alignment (`defineStack()`) | ⚠️ Partial | `defineStack()` from spec used, but `as any` cast bypasses Zod validation |
| 0.4 | Data Layer Upgrade | ⚠️ Partial | `ObjectStackAdapter` integrated + `ConnectionStatus`; metadata still loaded statically |
| 0.5 | Schema-Driven Architecture | ⚠️ Partial | `ObjectView` delegates to `plugin-view` with ViewSwitcher; Filter/Sort delegated to plugins internally |
| 0.6 | Developer Experience | ✅ Done | Shared `MetadataInspector`, Error Boundaries, 34 test files |
| 0.7 | MSW Runtime Fixes | ⚠️ Partial | MSW functional via lazy-load; workarounds remain in `objectstack.config.ts` + `vite.config.ts` |
| 0.8 | Layout System | ✅ Done | Branding/theming via `AppShell`, mobile-responsive layout |
| 0.9 | Navigation & Routing | ✅ Done | Deep-links, `⌘+K` command palette, expression-based visibility |
| 0.10 | Action System (Foundation) | ⚠️ Partial | `useObjectActions` hook with callbacks; declarative `ActionEngine` not yet implemented |

**Remaining items to close Phase 0:**
- [ ] Remove `as any` cast in `objectstack.shared.ts` — use proper typed config
- [ ] Migrate static metadata loading to runtime `getView()`/`getApp()` calls
- [ ] Clean up MSW workarounds in `objectstack.config.ts`
- [ ] Implement declarative `ActionEngine` from `@object-ui/core`

---

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

### Phase 2: Action System Completion ⚠️ Partially Complete

**Goal:** Unify the action system and make ActionRunner production-ready with typed dispatch, toast notifications, dialog confirmations, and redirect handling.

**Status:** ⚠️ Partial — `useObjectActions` hook provides create/delete/navigate/refresh handlers with toast notifications via Sonner. However, the declarative `ActionEngine` pipeline (events → `ActionDef[]` dispatch) from the JSON Protocol is **not yet implemented**. CRUD dialog uses inline callbacks, not `ActionSchema`.

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Canonical ActionDef type | ⚠️ Partial (typed hook, not full ActionDef pipeline) |
| 2.2 | Type `ActionRunner.execute()` with `ActionDef` | ❌ Not implemented |
| 2.3 | Toast action handler (Sonner) | ✅ Done (in `useObjectActions`) |
| 2.4 | Dialog confirmation action handler | ✅ Done (`confirmText` in delete flow) |
| 2.5 | Redirect result handling | ✅ Done (`navigate` handler in `useObjectActions`) |
| 2.6 | Wire action buttons into ObjectView toolbar | ✅ Done (`objectDef.actions[]` rendering) |
| 2.7 | Bulk action support | ✅ Done (multi-row selection in plugin-grid) |
| 2.8 | Custom toolbar actions from schema | ✅ Done (`action.location === 'list_toolbar'`) |

---

### Phase 3: Server-Driven Metadata API ⚠️ Partially Complete

**Goal:** Add `getView`, `getApp`, `getPage` methods to the DataSource interface so the console can fetch UI definitions from the server instead of using static config.

**Status:** ⚠️ Partial — All three methods exist on `DataSource` interface and are implemented in `ObjectStackAdapter` with metadata caching. However, the console **still loads objects/apps from static `objectstack.shared.ts`** rather than fetching at runtime. Views are resolved from `objectDef.list_views` (static), not via `client.meta.getView()`.

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | `getView(objectName, viewId)` on DataSource | ✅ Done |
| 3.2 | `getApp(appId)` on DataSource | ✅ Done |
| 3.3 | `getPage(pageId)` on DataSource | ✅ Done |
| 3.4 | Implement in `ObjectStackAdapter` | ✅ Done (with `MetadataCache`) |
| 3.5 | Metadata cache layer (TTL + ETag) | ✅ Done |
| 3.6 | Console: fetch app config from server | ⚠️ Adapter supports it, but console uses static config |
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

### Phase 10: Data Interaction Foundation (v1.0 Blockers) 🔲 Planned

**Goal:** Implement core data interaction features required for v1.0 GA — file upload, related record lookup, export, ActionEngine, and server-driven metadata loading.

**Status:** 🔲 Not Started — These are v1.0 blockers that must ship before GA.

**Approach:** Progressive implementation with L1 (Foundation) → L2 (Production) → L3 (Excellence) maturity stages. Each feature starts with a minimal viable implementation (L1), then evolves to production-ready quality (L2), and optionally to advanced capabilities (L3).

#### 10.1: File Upload Foundation

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Basic file input field with preview in forms. Single file upload with progress indicator. Accepts common file types (images, PDFs, docs). | 🔲 Planned | `FieldMetadata` type `file` + `FileUploadField` widget |
| **L2 (Production)** | Drag-and-drop upload zone, multi-file support, file size validation, thumbnail previews, delete uploaded files. | 🔲 Planned | `FileFieldMetadata.multiple`, `maxSize`, `accept` properties |
| **L3 (Excellence)** | Direct camera/photo capture, image cropping/editing, cloud storage integration, upload resume on failure. | 🔲 Planned | Extended `FileFieldMetadata` with `capture`, `crop`, `storage` options |

**Acceptance Criteria (L1):**
- FileUploadField widget renders in ObjectForm for `type: "file"` fields
- User can select a file from disk via file picker
- Upload progress indicator shows during file transfer
- Preview component displays uploaded file (image thumbnail or file icon)
- File URL stored in record data after successful upload

#### 10.2: Related Record Lookup

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | LookupField widget with DataSource-integrated search. Type-ahead search returns matching records. Selected record displayed with primary field. | 🔲 Planned | `FieldMetadata` type `lookup` with `referenceObject` property |
| **L2 (Production)** | Advanced search with multiple fields, record preview on hover, quick-create button for related records, multi-select lookup. | 🔲 Planned | `LookupFieldMetadata.searchFields`, `quickCreate`, `multiple` |
| **L3 (Excellence)** | Dependent lookups (filter options based on other fields), hierarchical lookups (parent-child relationships), lookup result caching. | 🔲 Planned | `dependsOn` filters, `hierarchical` mode, caching strategy |

**Acceptance Criteria (L1):**
- LookupField widget renders for `type: "lookup"` fields
- Type-ahead search queries DataSource with search term
- Search results display in dropdown with primary field text
- Selected record ID stored in form data
- Selected record name displayed in field after selection

#### 10.3: Grid Export

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | CSV/JSON export button on Grid toolbar. Exports visible columns and current filtered/sorted data. | 🔲 Planned | `ListViewSchema.exportOptions` with `csv`, `json` formats |
| **L2 (Production)** | Excel (XLSX) export, PDF export with formatting, export all data (not just visible), custom column selection for export. | 🔲 Planned | `exportOptions.formats: ["csv", "xlsx", "json", "pdf"]` |
| **L3 (Excellence)** | Scheduled exports via automation, export templates with custom formatting, email export results, export to cloud storage. | 🔲 Planned | Integration with Phase 18 Automation workflows |

**Acceptance Criteria (L1):**
- Export button appears in Grid toolbar
- CSV export downloads file with column headers + data rows
- JSON export downloads array of record objects
- Export respects current filters and sort order
- Export includes only visible columns

#### 10.4: ActionEngine (Declarative Actions)

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Declarative `ActionDef[]` → `ActionRunner` pipeline. Replace callback-based `useObjectActions` with event-driven dispatch. Support core action types: `navigate`, `create`, `update`, `delete`, `refresh`. | 🔲 Planned | `ActionSchema` from `@objectstack/spec` |
| **L2 (Production)** | Full action type coverage: `open_url`, `show_notification`, `confirm`, `execute_workflow`, `call_api`. Conditional actions (`enabled`, `visible` expressions). Action chaining (sequential execution). | 🔲 Planned | Complete `ActionSchema` type union implementation |
| **L3 (Excellence)** | Custom action handlers (plugin system), action middleware (logging, analytics), undo/redo support for reversible actions. | 🔲 Planned | `ActionHandler` plugin interface, middleware pipeline |

**Acceptance Criteria (L1):**
- `ActionRunner.execute(ActionDef)` method implemented in `@object-ui/core`
- CRUD dialog actions defined as `ActionDef[]` instead of callbacks
- Navigation actions dispatch through ActionRunner
- Toast notifications triggered by action results
- Error handling with user-friendly messages

#### 10.5: Server-Driven Metadata

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Console fetches app config from server at runtime using `DataSource.getApp()`, `getView()`, `getPage()` methods. Fallback to static config when server unavailable. | 🔲 Planned | `DataSource` interface metadata methods |
| **L2 (Production)** | Metadata caching with ETag support (already implemented in adapter), hot-reload on metadata changes, version compatibility checks. | ✅ Done (Adapter) | `MetadataCache` in `ObjectStackAdapter` |
| **L3 (Excellence)** | Metadata editing UI (admin console), metadata versioning and rollback, A/B testing with metadata variants. | 🔲 Planned | Advanced admin features |

**Acceptance Criteria (L1):**
- App.tsx fetches app config via `dataSource.getApp(appName)` on mount
- ObjectView resolves view definitions via `dataSource.getView(objectName, viewId)`
- Static `objectstack.shared.ts` config used as fallback when server unreachable
- MSW mock server returns metadata from `/api/meta/apps/:appName` endpoint
- Console displays loading state during metadata fetch

**Success Metrics:**
- [ ] File upload works in forms with progress indicator
- [ ] Lookup field searches related records via DataSource
- [ ] Grid export button downloads CSV with current data
- [ ] All CRUD actions dispatched through ActionEngine
- [ ] Console loads app config from server (not static file)

---

### Phase 11: Grid & Table Excellence 🔲 Planned

**Goal:** Elevate the Grid view to Airtable-level UX with frozen columns, row grouping, conditional formatting, and Excel-like interactions.

**Status:** 🔲 Not Started — Post-v1.0 features for enhanced productivity.

#### 11.1: Frozen Columns & Row Height

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Freeze first column (checkbox + primary field). Row height toggle: compact/medium/tall. | 🔲 Planned | `GridConfig.frozenColumns: number`, `rowHeight: "compact" \| "medium" \| "tall"` |
| **L2 (Production)** | Freeze multiple columns (user-configurable), persist frozen state per view, auto-scroll to frozen columns. | 🔲 Planned | `GridConfig.frozenColumns` array support |
| **L3 (Excellence)** | Split-pane mode (frozen left + scrollable right), diagonal freeze (top-left corner), Excel-like freeze panes UI. | 🔲 Planned | Advanced grid layout modes |

#### 11.2: Row Grouping

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Native row grouping by single field (not just AG Grid). Expand/collapse groups. Group headers show count. | 🔲 Planned | `ListViewSchema.groupBy: string` field name |
| **L2 (Production)** | Multi-level grouping (nested groups), group aggregations (sum, count, avg), group sorting. | 🔲 Planned | `groupBy: string[]` array, `aggregations` config |
| **L3 (Excellence)** | Drag-and-drop group reordering, group filtering, group-level actions (bulk update group). | 🔲 Planned | Interactive group management |

#### 11.3: Conditional Row Coloring

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Row background color based on field value. Simple color mapping: `status === "urgent"` → red background. | 🔲 Planned | `ListViewSchema.conditionalFormatting` with row-level rules |
| **L2 (Production)** | Complex conditional expressions, multiple rules (priority-based), cell-level formatting (not just rows). | 🔲 Planned | `ConditionalFormattingRule[]` with expression engine |
| **L3 (Excellence)** | Gradient coloring (numeric ranges), icon overlays, custom CSS class injection. | 🔲 Planned | Advanced formatting options |

#### 11.4: Copy-Paste & Excel Interactions

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Copy single cell to clipboard. Paste plain text into cell. | 🔲 Planned | Clipboard API integration |
| **L2 (Production)** | Copy-paste cell ranges (multi-select), paste from Excel with delimiter detection, paste into multiple cells. | 🔲 Planned | Range selection + clipboard parsing |
| **L3 (Excellence)** | Formula bar for editing cell values, drag-fill (Excel-style autofill), keyboard navigation (arrows, Tab, Enter). | 🔲 Planned | Excel-like UX patterns |

**Success Metrics:**
- [ ] User can freeze first column and toggle row height
- [ ] Grid rows grouped by field with expand/collapse
- [ ] Rows conditionally colored based on status field
- [ ] User can copy-paste cells to/from Excel

---

### Phase 12: Record Detail & Navigation 🔲 Planned

**Goal:** Enhance record detail pages with prev/next navigation, related records, comments, and activity history.

**Status:** 🔲 Not Started — Improves record-centric workflows.

#### 12.1: Prev/Next Record Navigation

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Prev/Next buttons in record detail header. Navigate through records in current view's result set. | 🔲 Planned | Navigation controls in `RecordDetailView` |
| **L2 (Production)** | Keyboard shortcuts (← / → arrows), preserve scroll position, show current position (e.g., "3 of 25"). | 🔲 Planned | Enhanced UX with keyboard support |
| **L3 (Excellence)** | Jump to first/last record, filter within navigation (search while navigating), breadcrumb trail of visited records. | 🔲 Planned | Advanced navigation features |

#### 12.2: Related Records Integration

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | RelatedList component renders related records from DataSource. Display as grid or list view. | 🔲 Planned | `RelatedListSchema` with `relatedObject`, `relationshipField` |
| **L2 (Production)** | Inline create related record, link existing record, unlink records, filter related records. | 🔲 Planned | Full CRUD operations on related records |
| **L3 (Excellence)** | Multi-level related records (nested relationships), related record preview on hover, related record graph view. | 🔲 Planned | Deep relationship navigation |

#### 12.3: Comments & Activity Timeline

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Record-level comments component. Add comment, view comment list, timestamp + author display. | 🔲 Planned | `CommentSchema` with `author`, `text`, `createdAt` |
| **L2 (Production)** | Rich text comments (markdown), @mention notifications, comment reactions (emoji), edit/delete comments. | 🔲 Planned | Enhanced comment features |
| **L3 (Excellence)** | Threaded discussions (reply to comment), comment attachments, activity filtering (show only comments / field changes). | 🔲 Planned | Advanced collaboration features |

#### 12.4: Record Revision History

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Display field change history. Show who changed what field and when. | 🔲 Planned | Server-side audit log integration |
| **L2 (Production)** | Diff view (before/after values), revert to previous version, revision timeline visualization. | 🔲 Planned | Revision management UI |
| **L3 (Excellence)** | Point-in-time restore, bulk revert multiple fields, revision approval workflow. | 🔲 Planned | Advanced version control |

**Success Metrics:**
- [ ] Prev/Next buttons navigate through records in view
- [ ] Related records displayed below main record
- [ ] Comments posted and displayed on record
- [ ] Field change history visible in activity timeline

---

### Phase 13: Kanban & Views Enhancement 🔲 Planned

**Goal:** Close Kanban UX gaps (quick add, cover images, collapse, conditional coloring) and add advanced view features.

**Status:** 🔲 Not Started — Improves Kanban and visual view types.

#### 13.1: Kanban Quick Add & Cover Image

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Quick Add button at bottom of each Kanban column. Click to add card inline. Cover image field support (show image on card top). | 🔲 Planned | `KanbanConfigSchema.quickAdd`, `coverImageField` |
| **L2 (Production)** | Inline editing in quick-add (no dialog), image upload for cover field, cover image fit options (cover/contain). | 🔲 Planned | Enhanced quick-add UX |
| **L3 (Excellence)** | Drag to reorder quick-add, batch quick-add (add multiple cards), AI-suggested cover images. | 🔲 Planned | Advanced quick-add features |

#### 13.2: Kanban Column Collapse & Conditional Coloring

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Collapse/expand Kanban columns. Collapsed column shows count only. Card conditional coloring (border or background based on field value). | 🔲 Planned | `KanbanConfig.allowCollapse`, `conditionalFormatting` |
| **L2 (Production)** | Persist collapsed state per user, conditional column visibility (hide empty columns), card badges (priority, tags). | 🔲 Planned | Enhanced column management |
| **L3 (Excellence)** | Custom column widths, horizontal scroll for many columns, column drag-to-reorder. | 🔲 Planned | Advanced layout customization |

#### 13.3: Kanban Swimlanes & Card Templates

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Swimlanes: 2D grouping (columns + rows). Group by second field for horizontal lanes. | 🔲 Planned | `KanbanConfig.swimlaneField` property |
| **L2 (Production)** | Card templates (predefined field values for new cards), swimlane collapse/expand, swimlane aggregations. | 🔲 Planned | `cardTemplates[]` configuration |
| **L3 (Excellence)** | Multi-level swimlanes (nested grouping), swimlane drag-to-reorder, cross-swimlane card movement. | 🔲 Planned | Advanced 2D layout features |

**Success Metrics:**
- [ ] Quick Add button creates cards inline at column bottom
- [ ] Cover images display on Kanban cards
- [ ] Columns can be collapsed to show count only
- [ ] Cards conditionally colored based on priority field
- [ ] Swimlanes group cards by second field (2D layout)

---

### Phase 14: Forms & Data Collection 🔲 Planned

**Goal:** Complete FileUploadField widget, add embeddable standalone forms, and form analytics.

**Status:** 🔲 Not Started — Enables external data collection use cases.

#### 14.1: Complete FileUploadField Widget

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Drag-and-drop upload zone, upload progress bar, file preview (image/PDF/doc icons), delete uploaded file button. | 🔲 Planned | Full `FileUploadField` implementation |
| **L2 (Production)** | Multi-file upload with individual progress bars, file size/type validation with error messages, thumbnail grid for images. | 🔲 Planned | `FileFieldMetadata.multiple`, validation rules |
| **L3 (Excellence)** | Camera capture for mobile, image cropping/rotation, cloud storage integration (S3, Azure Blob), upload resume on network failure. | 🔲 Planned | Advanced file handling |

#### 14.2: Embeddable Standalone Forms

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Standalone form URL (no authentication required). Shareable link for external submissions. Submission creates record in object. | 🔲 Planned | `FormConfig.embeddable`, `/forms/:formId` route |
| **L2 (Production)** | Prefill URL parameters (`?name=John&email=...`), custom thank-you page redirect, form branding (logo, colors). | 🔲 Planned | `FormConfig.prefillParams`, `thankYouPage` |
| **L3 (Excellence)** | Multi-page forms (wizard steps), conditional form logic (skip fields based on answers), form expiration (time-limited access). | 🔲 Planned | Advanced form features |

#### 14.3: Form Analytics & Submissions Dashboard

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Submissions dashboard showing form fill rate, completion time, field drop-off. | 🔲 Planned | Analytics component |
| **L2 (Production)** | Field-level analytics (most skipped, most errored), submission heatmap (time of day), A/B testing support. | 🔲 Planned | Detailed analytics |
| **L3 (Excellence)** | Real-time submission monitoring, export submissions as CSV, webhook on form submit. | 🔲 Planned | Advanced monitoring |

**Success Metrics:**
- [ ] FileUploadField supports drag-and-drop + multi-file upload
- [ ] Standalone form URL created and shareable
- [ ] Prefill URL parameters populate form fields
- [ ] Form analytics dashboard shows submission metrics

---

### Phase 15: Import/Export & Data Portability 🔲 Planned

**Goal:** Data import wizard, universal export across all views, shared view links, and API export endpoints.

**Status:** 🔲 Not Started — Enables data migration and sharing.

#### 15.1: CSV/Excel Import Wizard

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Import CSV/Excel file. Map columns to fields. Validate data types. Create records on import. | 🔲 Planned | Import wizard component |
| **L2 (Production)** | Preview import (show first 10 rows), error handling (skip invalid rows or stop on error), update existing records (match by unique field). | 🔲 Planned | Advanced import options |
| **L3 (Excellence)** | Import templates (save column mappings), scheduled imports (watch folder), import rollback (undo import). | 🔲 Planned | Enterprise import features |

#### 15.2: Universal Export (All Views)

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Export button on all view types (Grid, Kanban, Calendar, Gallery). CSV + JSON formats. Export current filtered data. | 🔲 Planned | `ListViewSchema.exportOptions` |
| **L2 (Production)** | Excel (XLSX) with formatting, PDF export with view layout preserved, export all data (bypass pagination). | 🔲 Planned | Advanced export formats |
| **L3 (Excellence)** | Custom export templates, scheduled exports (daily/weekly email), export to cloud storage (S3, Google Drive). | 🔲 Planned | Enterprise export features |

#### 15.3: Shared View Links & Permissions

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Generate shareable read-only view link. Public URL (no login required). View data only (no edit/delete). | 🔲 Planned | Sharing feature |
| **L2 (Production)** | Password-protected shared links, expiration date for links, view-level permissions (show only certain fields). | 🔲 Planned | Secure sharing |
| **L3 (Excellence)** | Edit permissions in shared link, comment-only access, share analytics (who viewed, when). | 🔲 Planned | Collaborative sharing |

#### 15.4: API Export Endpoints

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | REST API endpoint for programmatic export: `GET /api/export/:objectName?format=csv`. Returns data in specified format. | 🔲 Planned | API export |
| **L2 (Production)** | GraphQL export query, webhook-triggered exports, bulk export multiple objects. | 🔲 Planned | Advanced API features |
| **L3 (Excellence)** | Streaming export for large datasets, incremental export (delta sync), export audit log. | 🔲 Planned | Enterprise API features |

**Success Metrics:**
- [ ] CSV import wizard maps columns and creates records
- [ ] Export button works on all view types (Grid, Kanban, Calendar, Gallery)
- [ ] Shared view link generated and accessible without login
- [ ] API export endpoint returns data in CSV/JSON format

---

### Phase 16: Undo/Redo & Data Safety 🔲 Planned

**Goal:** Implement global undo/redo for data operations, record revision history, and time-travel debugging.

**Status:** 🔲 Not Started — Critical UX gap identified in Airtable benchmarking.

#### 16.1: Global Undo Manager

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Global undo/redo for CRUD operations (create, update, delete). Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo). Undo stack with max size (e.g., 50 operations). | 🔲 Planned | `UndoManager` service in `@object-ui/core` |
| **L2 (Production)** | Undo/redo UI (toast notification on undo), batch undo (undo multiple operations at once), undo history panel (show stack). | 🔲 Planned | Enhanced undo UX |
| **L3 (Excellence)** | Persistent undo stack (survives page reload), undo branching (multiple undo paths), undo conflicts (merge or reject). | 🔲 Planned | Advanced undo features |

#### 16.2: Record Revision History (Server-Side)

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Server-side audit log tracks field changes. Display revision history in record detail page. Show who changed what and when. | 🔲 Planned | Server audit log integration |
| **L2 (Production)** | Diff view (side-by-side comparison), revert to previous version, revision comments (explain why change was made). | 🔲 Planned | Revision management |
| **L3 (Excellence)** | Revision approval workflow (changes require approval), revision export (download change history), revision notifications (alert on change). | 🔲 Planned | Enterprise revision features |

#### 16.3: Time-Travel Debugging & Operation Replay

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Developer tool: view operation log (all CRUD operations). Filter by object, user, date. | 🔲 Planned | Dev tools integration |
| **L2 (Production)** | Replay operations (re-execute operation sequence), operation diff (compare two states), operation export (JSON log). | 🔲 Planned | Advanced debugging |
| **L3 (Excellence)** | Point-in-time restore (restore object to previous state), operation rollback (undo all operations after timestamp), operation migration (replay operations on different environment). | 🔲 Planned | Enterprise debugging features |

**Success Metrics:**
- [ ] Ctrl+Z undoes last CRUD operation
- [ ] Ctrl+Shift+Z redoes undone operation
- [ ] Record detail shows revision history with diffs
- [ ] Developer tool displays operation log

---

### Phase 17: Collaboration & Communication 🔲 Planned

**Goal:** Add record-level comments, @mention notifications, activity feed, and threaded discussions.

**Status:** 🔲 Not Started — Enables team collaboration workflows.

#### 17.1: Record-Level Comments

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Comments component in record detail page. Add comment (plain text), view comment list, display author + timestamp. | 🔲 Planned | `CommentSchema` |
| **L2 (Production)** | Rich text comments (markdown/HTML), edit/delete own comments, comment reactions (emoji), comment sorting (newest/oldest). | 🔲 Planned | Enhanced comments |
| **L3 (Excellence)** | Comment attachments (files, images), comment search, comment export, comment moderation (admin delete). | 🔲 Planned | Advanced comment features |

#### 17.2: @Mention Notifications & Activity Feed

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | @mention autocomplete in comments. Notify mentioned user (in-app notification). Activity feed in sidebar (show recent activity). | 🔲 Planned | Notification system |
| **L2 (Production)** | Email notifications for @mentions, notification preferences (enable/disable per activity type), mark notifications as read. | 🔲 Planned | Full notification system |
| **L3 (Excellence)** | Notification grouping (batch similar notifications), notification snooze, notification webhook (send to Slack/Teams). | 🔲 Planned | Enterprise notifications |

#### 17.3: Threaded Discussions & Email Notifications

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Reply to comment (threaded discussion). Display thread hierarchy (indent replies). Collapse/expand threads. | 🔲 Planned | Threaded comments |
| **L2 (Production)** | Thread notifications (notify on reply), thread resolution (mark as resolved), thread subscription (follow thread). | 🔲 Planned | Enhanced threads |
| **L3 (Excellence)** | Thread export (download discussion), thread permissions (restrict replies), thread AI summary (summarize long threads). | 🔲 Planned | Advanced thread features |

**Success Metrics:**
- [ ] Comments posted on record detail page
- [ ] @mention triggers notification to mentioned user
- [ ] Activity feed shows recent comments and changes
- [ ] Threaded replies display with indentation

---

### Phase 18: Automation & Workflows (Post v1.0) 🔲 Planned

**Goal:** Visual automation builder for trigger-action workflows, leveraging ProcessDesigner from designer phase.

**Status:** 🔲 Not Started — Post-v1.0 enterprise feature.

#### 18.1: Trigger-Action Pipeline UI

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | UI for configuring automations: select trigger (record created, field updated), select action (send email, update field). Save automation definition. | 🔲 Planned | Automation config UI |
| **L2 (Production)** | Conditional triggers (only when field matches value), multi-step actions (action sequence), action parameters (customize action behavior). | 🔲 Planned | Advanced automation config |
| **L3 (Excellence)** | Automation templates (pre-built workflows), automation testing (dry run), automation analytics (execution count, success rate). | 🔲 Planned | Enterprise automation features |

#### 18.2: Visual Automation Builder (ProcessDesigner Integration)

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Leverage ProcessDesigner plugin for visual workflow design. Drag-and-drop nodes (trigger, condition, action). Connect nodes to define flow. | 🔲 Planned | `@object-ui/plugin-designer` integration |
| **L2 (Production)** | Branching logic (if/else conditions), loops (repeat action), error handling (catch errors, retry). | 🔲 Planned | Advanced workflow features |
| **L3 (Excellence)** | Sub-workflows (call another workflow), parallel execution (run actions in parallel), workflow versioning (save versions, rollback). | 🔲 Planned | Enterprise workflow features |

#### 18.3: Scheduled Triggers, Webhooks & Run History

| Maturity Level | Description | Status | Spec Compliance |
|----------------|-------------|--------|-----------------|
| **L1 (Foundation)** | Scheduled triggers (run automation daily/weekly). Webhook actions (HTTP POST on trigger). Run history (show past executions). | 🔲 Planned | Automation execution features |
| **L2 (Production)** | Cron expressions for complex schedules, webhook retry on failure, run history filtering (by status, date). | 🔲 Planned | Advanced execution features |
| **L3 (Excellence)** | Webhook signature verification, run history export, automation monitoring dashboard (execution metrics). | 🔲 Planned | Enterprise execution features |

**Success Metrics:**
- [ ] Automation created via UI (trigger + action)
- [ ] ProcessDesigner renders visual workflow
- [ ] Scheduled trigger executes automation daily
- [ ] Webhook action sends HTTP POST on trigger
- [ ] Run history displays past automation executions

---

## 5. UI Feature Roadmap

> **Re-prioritized (Feb 16, 2026):** Features reorganized by progressive maturity stages (L1/L2/L3). Phases 10-18 use "shallow to deep" (由浅入深) approach for incremental development.

### 5.1 Object Management

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| Grid view (sort, filter, search) | ✅ Done | — | — |
| Kanban board | ✅ Done | — | — |
| Calendar view | ✅ Done | — | — |
| Timeline view | ✅ Done | — | — |
| Gallery view | ✅ Done | — | — |
| Map view | ✅ Done | — | — |
| Gantt chart | ✅ Done | — | — |
| Chart view | ✅ Done | — | — |
| Inline editing (grid) | ✅ Done | — | — |
| Bulk actions (select + execute) | ✅ Done | — | Phase 2 |
| Column reordering & persistence | ✅ Done | — | Phase 7 |
| Saved filters / views | ✅ Done | — | Phase 3 |
| **Export (CSV, JSON)** | 🔲 Planned | **🎯 v1.0 Essential** | Phase 10 (L1) |
| **Export (Excel, PDF)** | 🔲 Planned | Post v1.0 | Phase 11 (L2) |
| **Frozen columns** | 🔲 Planned | Post v1.0 | Phase 11 (L1) |
| **Row grouping (native)** | 🔲 Planned | Post v1.0 | Phase 11 (L2) |
| **Conditional row coloring** | 🔲 Planned | Post v1.0 | Phase 11 (L1) |
| **Copy-paste from Excel** | 🔲 Planned | Post v1.0 | Phase 11 (L3) |
| Import (CSV, Excel) | 🔲 Planned | Post v1.0 | Phase 15 (L1) |

### 5.2 Forms & Records

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| Create/edit dialog | ✅ Done | — | — |
| Field type mapping | ✅ Done | — | — |
| Record detail page | ✅ Done | — | — |
| Record drawer (sheet) | ✅ Done | — | — |
| Form variants (tabbed, wizard, split) | ✅ Done | — | — |
| Conditional fields (dependsOn) | ✅ Done | — | — |
| Field validation | ✅ Done | — | — |
| **File upload fields (basic)** | 🔲 Planned | **🎯 v1.0 Essential** | Phase 10 (L1) |
| **File upload fields (complete)** | 🔲 Planned | Post v1.0 | Phase 14 (L1) |
| **Related record lookup** | 🔲 Planned | **🎯 v1.0 Essential** | Phase 10 (L1) |
| **Prev/Next record navigation** | 🔲 Planned | Post v1.0 | Phase 12 (L1) |
| **Comments / Activity history** | 🔲 Planned | Post v1.0 | Phase 12 (L1) |
| **Record revision history** | 🔲 Planned | Post v1.0 | Phase 12 (L2) |
| **Embeddable form URL** | 🔲 Planned | Post v1.0 | Phase 14 (L1) |
| Rich text editor fields | 🔲 Planned | Post v1.0 | Phase 14 (L3) |
| Audit trail (field change history) | 🔲 Planned | Post v1.0 | Phase 16 (L2) |

### 5.3 Dashboards & Reports

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| Dashboard renderer | ✅ Done | — | — |
| Chart widgets | ✅ Done | — | — |
| Report viewer | ✅ Done | — | — |
| Report builder | ✅ Done | — | — |
| Real-time dashboard auto-refresh | ✅ Done | — | Phase 6 |
| Report export (PDF, Excel) | 🔲 Planned | Post v1.0 | Phase 15 (L2) |
| Dashboard drag & drop layout | 🔲 Planned | Post v1.0 | Phase 15 (L3) |
| Scheduled reports (email) | 🔲 Planned | Post v1.0 | Phase 18 (L1) |

### 5.4 Navigation & UX

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| Multi-app switcher | ✅ Done | — | — |
| Recursive navigation tree | ✅ Done | — | — |
| Command palette (⌘+K) | ✅ Done | — | — |
| Expression-based visibility | ✅ Done | — | Phase 1 |
| Dark/light theme | ✅ Done | — | — |
| Per-app branding | ✅ Done | — | — |
| Breadcrumbs | ✅ Done | — | — |
| Keyboard shortcuts | ✅ Done | — | — |
| Mobile-responsive layout | ✅ Done | — | Phase 8 |
| Language switcher | ✅ Done | — | Phase 4 |
| Global search (cross-object) | ✅ Done | — | — |
| **Global Undo/Redo (Ctrl+Z)** | 🔲 Planned | Post v1.0 | Phase 16 (L1) |
| Notification center | 🔲 Planned | Post v1.0 | Phase 17 (L2) |
| Activity feed | 🔲 Planned | Post v1.0 | Phase 17 (L1) |

### 5.5 Kanban & Visual Views

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| **Kanban Quick Add button** | 🔲 Planned | Post v1.0 | Phase 13 (L1) |
| **Kanban cover image** | 🔲 Planned | Post v1.0 | Phase 13 (L1) |
| **Kanban column collapse** | 🔲 Planned | Post v1.0 | Phase 13 (L1) |
| **Kanban card coloring** | 🔲 Planned | Post v1.0 | Phase 13 (L1) |
| **Kanban swimlanes (2D grouping)** | 🔲 Planned | Post v1.0 | Phase 13 (L3) |
| **Kanban card templates** | 🔲 Planned | Post v1.0 | Phase 13 (L2) |

### 5.6 Collaboration

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| **Record-level comments** | 🔲 Planned | Post v1.0 | Phase 17 (L1) |
| **@mention notifications** | 🔲 Planned | Post v1.0 | Phase 17 (L1) |
| **Threaded discussions** | 🔲 Planned | Post v1.0 | Phase 17 (L3) |
| **Email notifications** | 🔲 Planned | Post v1.0 | Phase 17 (L2) |

### 5.7 Automation

| Feature | Status | Priority | Phase |
|---------|--------|----------|-------|
| **Automation Builder UI** | 🔲 Planned | Post v1.0 | Phase 18 (L1) |
| **Visual workflow designer** | 🔲 Planned | Post v1.0 | Phase 18 (L2) |
| **Scheduled triggers** | 🔲 Planned | Post v1.0 | Phase 18 (L1) |
| **Webhook actions** | 🔲 Planned | Post v1.0 | Phase 18 (L1) |
| **Automation run history** | 🔲 Planned | Post v1.0 | Phase 18 (L1) |

---

## 6. Execution Timeline

> **Re-prioritized (Feb 16, 2026):** Progressive maturity stages (L1/L2/L3) organize features by depth. Each phase builds incrementally from foundation to excellence.

```
2026 Q1 (Feb 7-13)  — BOOTSTRAP COMPLETE ✅
═══════════════════════════════════════════════════════════
  Phase 0: Bootstrap & Foundation     ██████████████  ✅ Complete (4 items remaining)

2026 Q1 (Feb-Mar)  — FEATURE PHASES
═══════════════════════════════════════════════════════════
  Phase 1: Expression Engine          ██████████████  ✅ Complete
  Phase 2: Action System              ██████████░░░░  ⚠️ Partial (no ActionEngine)
  Phase 3: Metadata API               ██████████░░░░  ⚠️ Partial (static config)
  Phase 4: Internationalization        ██████████████  ✅ Complete
  Phase 5: RBAC & Permissions          ██████████████  ✅ Complete
  Phase 6: Real-Time Updates           ██████████████  ✅ Complete
  Phase 7: Performance Optimization    ██████████████  ✅ Complete
  Phase 8: Offline / PWA              ██████████████  ✅ Complete
  Phase 9: NavigationConfig Spec      ██████████████  ✅ Complete

2026 Q1-Q2 (Mar-Apr) — v1.0 DATA INTERACTION (🎯 GA Blockers)
═══════════════════════════════════════════════════════════
  Phase 2 Completion: ActionEngine    ██░░░░░░░░░░░░  Declarative action dispatch
  Phase 3 Completion: Metadata API    ██░░░░░░░░░░░░  Server-driven config loading
  Phase 10: Data Interaction          ████░░░░░░░░░░  File upload, Lookup, Export, ActionEngine, Server metadata

2026 Q2 (May-Jun) — v1.0 GA: GRID & RECORD DETAIL
═══════════════════════════════════════════════════════════
  Phase 11: Grid Excellence           ██████░░░░░░░░  Frozen columns, Row grouping, Conditional coloring
  Phase 12: Record Detail             ████░░░░░░░░░░  Prev/Next nav, Comments, Activity history

2026 Q3 (Jul-Sep) — v1.1: VIEWS & FORMS
═══════════════════════════════════════════════════════════
  Phase 13: Kanban Enhancement        ████████░░░░░░  Quick Add, Cover image, Swimlanes
  Phase 14: Forms & Collection        ████████░░░░░░  Complete FileUpload, Embeddable forms, Analytics
  Phase 15: Import/Export             ██████░░░░░░░░  Import wizard, Universal export, Shared links

2026 Q4 (Oct-Dec) — v1.2: UNDO/REDO & COLLABORATION
═══════════════════════════════════════════════════════════
  Phase 16: Undo/Redo & Safety        ██████████░░░░  Global undo (Ctrl+Z), Revision history, Time-travel
  Phase 17: Collaboration             ████████░░░░░░  Comments, @mentions, Threads, Notifications

2027 Q1+ — v2.0: AUTOMATION & WORKFLOWS
═══════════════════════════════════════════════════════════
  Phase 18: Automation & Workflows    ████░░░░░░░░░░  Trigger-Action UI, Visual builder, Scheduled triggers
```

### Milestone Summary

| Milestone | Version | Date | Description |
|-----------|---------|------|-------------|
| **Bootstrap** | v0.5.0 | ✅ Feb 7, 2026 | 10 sub-phases: data layer, plugins, i18n, routing, DX |
| **Alpha** | v0.5.2 | ✅ Feb 14, 2026 | Expressions + Partial Actions + Metadata adapter + i18n + RBAC |
| **Beta** | v0.8.0 | Planned Mar 2026 | ActionEngine + Server-driven metadata + Phase 10 L1 features |
| **RC** | v0.9.0 | Planned Apr 2026 | Phase 10 complete + Phase 11/12 L1 features |
| **GA v1.0** | v1.0.0 | Q2 2026 | Core data interaction + Grid excellence + Record detail (Phases 10-12) |
| **v1.1** | v1.1.0 | Q3 2026 | Kanban + Forms + Import/Export (Phases 13-15) |
| **v1.2** | v1.2.0 | Q4 2026 | Undo/Redo + Collaboration (Phases 16-17) |
| **v2.0** | v2.0.0 | 2027 Q1+ | Automation & Workflows (Phase 18) |

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

### Phase 0 (Bootstrap) ✅
- [x] Official `ObjectStackAdapter` replaces local data source
- [x] 14 plugins registered in `main.tsx`
- [x] `defineStack()` used for config (Zod validation pending)
- [x] All UI strings in English; i18n keys via `useObjectTranslation`

### Phase 1-3 (Foundation) ⚠️ — v1.0 Blockers
- [x] 100% of navigation items respect `visible` expressions
- [ ] **🎯 v1.0:** All CRUD actions dispatched through declarative `ActionEngine` pipeline
- [ ] **🎯 v1.0:** Console fetches app config from server at runtime (currently static)

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

### Phase 10: Data Interaction Foundation (v1.0 Blockers) — 🎯 Priority
**L1 (Foundation) — v1.0 GA Scope:**
- [ ] FileUploadField widget renders with single file upload + progress
- [ ] LookupField widget searches related records via DataSource
- [ ] Grid export button downloads CSV/JSON with current data
- [ ] ActionEngine dispatches all CRUD actions from `ActionDef[]`
- [ ] Console fetches app config from server via `getApp()` method

**L2 (Production) — Post v1.0:**
- [ ] Multi-file upload with drag-and-drop + validation
- [ ] Advanced lookup search with multi-select + quick-create
- [ ] Excel/PDF export with custom column selection
- [ ] Full ActionEngine coverage (all action types, chaining)
- [ ] Metadata caching with hot-reload on changes

**L3 (Excellence) — Future:**
- [ ] Camera capture + image cropping in FileUpload
- [ ] Dependent lookups with hierarchical relationships
- [ ] Scheduled exports via automation
- [ ] Custom action handlers plugin system
- [ ] Metadata editing UI with versioning

### Phase 11: Grid & Table Excellence — Post v1.0
**L1 (Foundation):**
- [ ] Freeze first column (checkbox + primary field)
- [ ] Row height toggle (compact/medium/tall)
- [ ] Native row grouping by single field
- [ ] Conditional row coloring (simple field-based rules)

**L2 (Production):**
- [ ] Freeze multiple columns (user-configurable)
- [ ] Multi-level row grouping with aggregations
- [ ] Complex conditional formatting with expressions
- [ ] Copy-paste cell ranges to/from Excel

**L3 (Excellence):**
- [ ] Split-pane mode with frozen columns
- [ ] Drag-and-drop group reordering
- [ ] Gradient coloring for numeric ranges
- [ ] Formula bar for editing cell values

### Phase 12: Record Detail & Navigation — Post v1.0
**L1 (Foundation):**
- [ ] Prev/Next buttons navigate through records
- [ ] RelatedList component displays related records
- [ ] Comments component renders on record detail page
- [ ] Field change history visible in activity timeline

**L2 (Production):**
- [ ] Keyboard shortcuts (← / →) for record navigation
- [ ] Inline create/link related records
- [ ] Rich text comments with @mentions
- [ ] Diff view for revision history

**L3 (Excellence):**
- [ ] Jump to first/last record with search-while-navigating
- [ ] Multi-level related records with graph view
- [ ] Threaded discussions with attachments
- [ ] Point-in-time restore for records

### Phase 13: Kanban & Views Enhancement — Post v1.0
**L1 (Foundation):**
- [ ] Quick Add button at column bottom
- [ ] Cover image support on Kanban cards
- [ ] Column collapse/expand
- [ ] Card conditional coloring

**L2 (Production):**
- [ ] Inline editing in quick-add (no dialog)
- [ ] Card templates (predefined field values)
- [ ] Persist collapsed state per user
- [ ] Card badges (priority, tags)

**L3 (Excellence):**
- [ ] Swimlanes (2D grouping by second field)
- [ ] Drag to reorder quick-add cards
- [ ] Custom column widths with horizontal scroll
- [ ] Cross-swimlane card movement

### Phase 14: Forms & Data Collection — Post v1.0
**L1 (Foundation):**
- [ ] Drag-and-drop upload zone in FileUploadField
- [ ] Standalone form URL (embeddable, no auth)
- [ ] Form submissions create records
- [ ] Basic form analytics dashboard

**L2 (Production):**
- [ ] Multi-file upload with progress bars
- [ ] Prefill URL parameters populate fields
- [ ] Custom thank-you page redirect
- [ ] Field-level analytics (drop-off, errors)

**L3 (Excellence):**
- [ ] Camera capture for mobile uploads
- [ ] Multi-page forms (wizard steps)
- [ ] Conditional form logic (skip fields)
- [ ] Real-time submission monitoring

### Phase 15: Import/Export & Data Portability — Post v1.0
**L1 (Foundation):**
- [ ] CSV/Excel import wizard with column mapping
- [ ] Export button on all view types (Grid, Kanban, Calendar, Gallery)
- [ ] Shared read-only view link generated
- [ ] API export endpoint (`GET /api/export/:objectName`)

**L2 (Production):**
- [ ] Import preview (first 10 rows) with error handling
- [ ] Excel/PDF export with view layout preserved
- [ ] Password-protected shared links
- [ ] GraphQL export query support

**L3 (Excellence):**
- [ ] Import templates (save column mappings)
- [ ] Scheduled exports (email daily/weekly)
- [ ] Edit permissions in shared links
- [ ] Streaming export for large datasets

### Phase 16: Undo/Redo & Data Safety — Post v1.0
**L1 (Foundation):**
- [ ] Global undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- [ ] Undo stack with max size (50 operations)
- [ ] Server-side audit log displays field changes
- [ ] Developer operation log tool

**L2 (Production):**
- [ ] Undo/redo UI (toast notification)
- [ ] Batch undo (undo multiple operations)
- [ ] Diff view (side-by-side comparison)
- [ ] Revert to previous version

**L3 (Excellence):**
- [ ] Persistent undo stack (survives reload)
- [ ] Undo branching (multiple paths)
- [ ] Point-in-time restore for objects
- [ ] Operation replay on different environment

### Phase 17: Collaboration & Communication — Post v1.0
**L1 (Foundation):**
- [ ] Record-level comments posted and displayed
- [ ] @mention autocomplete in comments
- [ ] Activity feed shows recent activity
- [ ] Reply to comment (threaded discussion)

**L2 (Production):**
- [ ] Rich text comments (markdown)
- [ ] Email notifications for @mentions
- [ ] Notification preferences (enable/disable)
- [ ] Thread resolution (mark as resolved)

**L3 (Excellence):**
- [ ] Comment attachments (files, images)
- [ ] Notification grouping (batch similar)
- [ ] Thread AI summary (summarize long threads)
- [ ] Thread permissions (restrict replies)

### Phase 18: Automation & Workflows — Post v1.0 (v2.0)
**L1 (Foundation):**
- [ ] Automation created via UI (trigger + action)
- [ ] Scheduled triggers (daily/weekly)
- [ ] Webhook actions (HTTP POST)
- [ ] Run history displays past executions

**L2 (Production):**
- [ ] Visual workflow designer (ProcessDesigner integration)
- [ ] Conditional triggers (match field value)
- [ ] Multi-step actions (action sequence)
- [ ] Webhook retry on failure

**L3 (Excellence):**
- [ ] Sub-workflows (call another workflow)
- [ ] Parallel execution (run actions in parallel)
- [ ] Workflow versioning (save versions, rollback)
- [ ] Automation monitoring dashboard

---

## Appendix A: Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Development Plan (v0.1–v0.5) | Merged into Phase 0 above | Bootstrap phases (archived) |
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
