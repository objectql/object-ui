# ObjectStack Console — Complete Development Roadmap

> **Last Updated:** February 9, 2026
> **Current Version:** v0.5.1
> **Target Version:** v1.0.0 (GA)
> **Spec Alignment:** @objectstack/spec v2.0.1

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
| **Spec Compliance** | @objectstack/spec v2.0.1 coverage | 100% |
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

## 3. Current State (v0.5.1)

### Completed Features ✅

**Core Application:**
- ✅ Multi-app routing (`/apps/:appName/*`)
- ✅ App switcher dropdown in sidebar
- ✅ Dynamic navigation tree (object, group, page, dashboard, report, url)
- ✅ Expression-based visibility for navigation items
- ✅ Command palette (`⌘+K`) for quick navigation
- ✅ Per-app branding (logo, colors, favicon)
- ✅ Dark/light/system theme toggle
- ✅ Error boundary per route
- ✅ Connection status monitoring

**Data Layer:**
- ✅ Official `@object-ui/data-objectstack` adapter
- ✅ Auto-reconnect with exponential backoff
- ✅ Metadata caching (ETag-based)
- ✅ MSW browser-based mock server

**Object Views:**
- ✅ Plugin-based ObjectView (grid, kanban, calendar, timeline, chart, map, gantt, gallery)
- ✅ View switcher (multi-view tabs)
- ✅ Search, filter, sort UI
- ✅ Record drawer preview (Sheet)
- ✅ CRUD dialog (create/edit via ObjectForm)
- ✅ Metadata inspector (developer tool)

**Pages & Dashboards:**
- ✅ Dashboard renderer with chart widgets
- ✅ Report viewer with builder mode
- ✅ Custom page renderer (SchemaRenderer)
- ✅ Record detail page

**Testing:**
- ✅ 21 test files covering core flows
- ✅ MSW server-side mock for tests
- ✅ Plugin integration tests

### Known Gaps ⚠️

| # | Gap | Severity | Phase |
|---|-----|----------|-------|
| G1 | Expression engine not fully wired to all components | High | Phase 1 |
| G2 | Action system uses `any` types — no typed dispatch | High | Phase 2 |
| G3 | DataSource missing `getView`/`getApp` metadata API | High | Phase 3 |
| G4 | No i18n support — all labels are hardcoded English | Medium | Phase 4 |
| G5 | No RBAC integration — permission checks missing | Medium | Phase 5 |
| G6 | No real-time updates (WebSocket/SSE) | Medium | Phase 6 |
| G7 | No offline support / PWA | Low | Phase 7 |
| G8 | Bundle size 200KB+ (target < 150KB) | Medium | Phase 8 |

---

## 4. Development Phases

### Phase 1: Expression Engine Integration (1 week)

**Goal:** Make `visible`, `disabled`, `hidden`, `readOnly` expressions fully functional across all console components.

**Why:** Expressions are the core of SDUI — without them, the console is a static layout, not a dynamic one. The `ExpressionEvaluator` in `@object-ui/core` is already built; it just needs to be wired into every consumer.

| Task | Description | Files |
|------|-------------|-------|
| 1.1 | Wire `useExpression` into ObjectView for conditional column visibility | `components/ObjectView.tsx` |
| 1.2 | Add `disabled` expression evaluation in CRUD Dialog fields | `App.tsx` (Dialog section) |
| 1.3 | Enrich expression context with real user session data | `context/ExpressionProvider.tsx` |
| 1.4 | Add `readOnly` expression support in PageView sections | `components/PageView.tsx` |
| 1.5 | Unit tests for expression evaluation in navigation | `__tests__/ExpressionVisibility.test.tsx` |

**Acceptance Criteria:**
- Navigation items hide/show based on `visible: "${user.role === 'admin'}"` expressions
- Form fields disable based on `disabled: "${data.status === 'closed'}"` expressions
- All expression evaluations are covered by tests

---

### Phase 2: Action System Completion (1-2 weeks)

**Goal:** Unify the action system and make ActionRunner production-ready with typed dispatch, toast notifications, dialog confirmations, and redirect handling.

**Why:** Enterprise apps need a robust action system — toolbar buttons, row actions, bulk operations, workflows. The current system has two competing `ActionSchema` types and `ActionRunner.execute()` takes `any`.

| Task | Description | Files |
|------|-------------|-------|
| 2.1 | Deprecate `crud.ts` ActionSchema; use `ui-action.ts` as canonical type | `@object-ui/types` |
| 2.2 | Type `ActionRunner.execute()` with proper `ActionSchema` | `@object-ui/core` |
| 2.3 | Add `toast` action handler (Sonner integration) | `@object-ui/core` |
| 2.4 | Add `dialog` confirmation action handler | `@object-ui/react` |
| 2.5 | Add `redirect` result handling in `useActionRunner` | `@object-ui/react` |
| 2.6 | Wire action buttons into ObjectView toolbar from config | `components/ObjectView.tsx` |
| 2.7 | Add bulk action support (select rows → run action) | `components/ObjectView.tsx` |
| 2.8 | Add custom toolbar actions from schema | `components/ObjectView.tsx` |

**Acceptance Criteria:**
- Toolbar actions are driven by `objectDef.actions[]` schema
- Toast notifications appear after successful CRUD operations
- Confirmation dialogs appear for destructive actions (delete)
- Bulk actions work with multi-row selection

---

### Phase 3: Server-Driven Metadata API (1-2 weeks)

**Goal:** Add `getView`, `getApp`, `getPage` methods to the DataSource interface so the console can fetch UI definitions from the server instead of using static config.

**Why:** The console currently loads all metadata from a static merged config (`objectstack.shared.ts`). For production, the server should drive what the UI shows — this is the "Server-Driven" in SDUI.

| Task | Description | Files |
|------|-------------|-------|
| 3.1 | Add `getView(objectName, viewId)` to DataSource interface | `@object-ui/types` |
| 3.2 | Add `getApp(appId)` to DataSource interface | `@object-ui/types` |
| 3.3 | Add `getPage(pageId)` to DataSource interface | `@object-ui/types` |
| 3.4 | Implement in `ObjectStackAdapter` | `@object-ui/data-objectstack` |
| 3.5 | Add metadata cache layer (TTL + ETag invalidation) | `@object-ui/data-objectstack` |
| 3.6 | Console: fetch app config from server on load | `App.tsx` |
| 3.7 | Console: fallback to static config when server unavailable | `App.tsx` |
| 3.8 | MSW: mock metadata endpoints | `mocks/browser.ts`, `mocks/server.ts` |

**Acceptance Criteria:**
- Console loads app definition from `GET /api/v1/meta/apps/:appId`
- Console loads view definitions from `GET /api/v1/meta/views/:objectName/:viewId`
- Falls back gracefully to static config when metadata API is unavailable

---

### Phase 4: Internationalization (i18n) (2 weeks)

**Goal:** Full internationalization support — all UI text externalized, 10+ language packs, RTL layout.

**Why:** Enterprise software must support multiple languages. The console currently has English strings hardcoded in components.

| Task | Description | Files |
|------|-------------|-------|
| 4.1 | Integrate `@object-ui/i18n` package | `package.json`, `App.tsx` |
| 4.2 | Extract all hardcoded strings to translation keys | All components |
| 4.3 | Add language switcher in user menu | `components/AppSidebar.tsx` |
| 4.4 | Add Chinese (zh-CN) language pack | `locales/zh-CN.json` |
| 4.5 | Add Japanese (ja-JP) language pack | `locales/ja-JP.json` |
| 4.6 | Support RTL layout for Arabic | `index.css`, `App.tsx` |
| 4.7 | Date/number format localization | Utility functions |

**Acceptance Criteria:**
- All UI text rendered via `t()` translation function
- Language can be switched at runtime without page reload
- RTL layout works correctly for Arabic/Hebrew
- Date formats adapt to locale (e.g., DD/MM/YYYY vs MM/DD/YYYY)

---

### Phase 5: RBAC & Permission System (2 weeks)

**Goal:** Integrate object-level, field-level, and row-level permissions into the console, respecting the `requiredPermissions` field on apps, objects, and views.

**Why:** Enterprise management software needs granular access control. A sales rep shouldn't see HR data; a viewer shouldn't see the "Delete" button.

| Task | Description |
|------|-------------|
| 5.1 | Create `usePermissions` hook that reads user permissions from session |
| 5.2 | Gate app visibility in sidebar by `app.requiredPermissions` |
| 5.3 | Gate navigation items by `item.requiredPermissions` |
| 5.4 | Gate CRUD buttons by `object.permissions.create/update/delete` |
| 5.5 | Gate field visibility by `field.permissions.read` |
| 5.6 | Support row-level security (filter by ownership) |
| 5.7 | Add permission-denied fallback UI |
| 5.8 | Integration with ObjectStack RBAC API |

**Acceptance Criteria:**
- Admin sees all apps/objects; viewer sees only permitted ones
- Create/Edit/Delete buttons hidden when user lacks permission
- Sensitive fields (e.g., salary) hidden for unauthorized users
- Graceful "Permission Denied" page instead of errors

---

### Phase 6: Real-Time Updates (1-2 weeks)

**Goal:** Live data updates via WebSocket/SSE — when a record changes on the server, the console updates immediately without manual refresh.

**Why:** Multi-user enterprise environments need real-time collaboration. A Kanban board should move cards when a colleague changes status.

| Task | Description |
|------|-------------|
| 6.1 | Add WebSocket transport to `ObjectStackAdapter` |
| 6.2 | Subscribe to object change events |
| 6.3 | Auto-refresh grid/kanban/calendar on data change |
| 6.4 | Show presence indicators (who's viewing this record) |
| 6.5 | Optimistic updates for CRUD operations |
| 6.6 | Conflict resolution UI (stale data detection) |

**Acceptance Criteria:**
- Grid refreshes automatically when another user creates a record
- Kanban card moves in real-time when status changes
- "X users viewing" indicator on record detail page
- Stale data warning when editing an outdated record

---

### Phase 7: Performance Optimization (1-2 weeks)

**Goal:** Reduce bundle size to < 150KB (gzipped), achieve LCP < 600ms, and ensure smooth scrolling with 10,000+ records.

**Why:** Enterprise users expect fast load times and smooth interactions, even with large datasets.

| Task | Description |
|------|-------------|
| 7.1 | Code-split plugins (lazy load kanban, calendar, charts) |
| 7.2 | Virtual scrolling for grid with 10K+ rows |
| 7.3 | Memoize expensive schema computations |
| 7.4 | Reduce initial bundle (tree-shake unused Lucide icons) |
| 7.5 | Add service worker for static asset caching |
| 7.6 | Skeleton loading states for all views |
| 7.7 | Prefetch adjacent pages/views |

**Acceptance Criteria:**
- Initial bundle < 150KB gzipped
- LCP < 600ms on 3G connection
- Grid scrolls smoothly with 10,000 rows
- Plugin views load on-demand (< 100ms after route change)

---

### Phase 8: Offline & PWA Support (1 week)

**Goal:** Make the console installable as a PWA with offline data access and background sync.

**Why:** Field workers (sales reps, service engineers) need access even without internet connectivity.

| Task | Description |
|------|-------------|
| 8.1 | Add PWA manifest and service worker |
| 8.2 | IndexedDB adapter for offline data storage |
| 8.3 | Background sync queue for offline mutations |
| 8.4 | Offline indicator in header |
| 8.5 | Conflict resolution on reconnection |

**Acceptance Criteria:**
- Console installable as desktop/mobile app
- Recent data accessible offline
- Created/edited records sync when back online
- Clear offline status indicator

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
| Bulk actions (select + execute) | 🔲 Planned | Phase 2 |
| Column reordering & persistence | 🔲 Planned | Phase 7 |
| Saved filters / views | 🔲 Planned | Phase 3 |
| Export (CSV, Excel, PDF) | 🔲 Planned | Phase 9 |
| Import (CSV, Excel) | 🔲 Planned | Phase 9 |

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
| File upload fields | 🔲 Planned | Phase 9 |
| Rich text editor fields | 🔲 Planned | Phase 9 |
| Related record lookup | 🔲 Planned | Phase 9 |
| Audit trail (field change history) | 🔲 Planned | Phase 10 |

### 5.3 Dashboards & Reports

| Feature | Status | Phase |
|---------|--------|-------|
| Dashboard renderer | ✅ Done | — |
| Chart widgets | ✅ Done | — |
| Report viewer | ✅ Done | — |
| Report builder | ✅ Done | — |
| Dashboard drag & drop layout | 🔲 Planned | Phase 9 |
| Real-time dashboard auto-refresh | 🔲 Planned | Phase 6 |
| Report export (PDF, Excel) | 🔲 Planned | Phase 9 |
| Scheduled reports (email) | 🔲 Planned | Phase 10 |

### 5.4 Navigation & UX

| Feature | Status | Phase |
|---------|--------|-------|
| Multi-app switcher | ✅ Done | — |
| Recursive navigation tree | ✅ Done | — |
| Command palette (⌘+K) | ✅ Done | — |
| Expression-based visibility | ✅ Done | — |
| Dark/light theme | ✅ Done | — |
| Per-app branding | ✅ Done | — |
| Breadcrumbs | ✅ Done | — |
| Notification center | 🔲 Planned | Phase 10 |
| Activity feed | 🔲 Planned | Phase 10 |
| Global search (cross-object) | 🔲 Planned | Phase 9 |
| Keyboard shortcuts | 🔲 Planned | Phase 9 |
| Mobile-responsive layout | 🔲 Planned | Phase 9 |

---

## 6. Execution Timeline

```
2026 Q1 (Feb-Mar)
═══════════════════════════════════════════════════════════
  Phase 1: Expression Engine          ██████░░░░░░░░  1 week
  Phase 2: Action System              ██████████░░░░  2 weeks
  Phase 3: Metadata API               ████████░░░░░░  2 weeks

2026 Q2 (Apr-Jun)
═══════════════════════════════════════════════════════════
  Phase 4: Internationalization        ████████░░░░░░  2 weeks
  Phase 5: RBAC & Permissions          ████████░░░░░░  2 weeks
  Phase 6: Real-Time Updates           ██████░░░░░░░░  2 weeks
  Phase 7: Performance Optimization    ██████░░░░░░░░  2 weeks

2026 Q3 (Jul-Sep)
═══════════════════════════════════════════════════════════
  Phase 8: Offline / PWA              ██████░░░░░░░░  1 week
  Phase 9: Advanced Features          ██████████████  4 weeks
  Phase 10: Enterprise Features       ██████████░░░░  3 weeks

2026 Q4 (Oct-Dec)
═══════════════════════════════════════════════════════════
  v1.0.0 GA Release                   ████░░░░░░░░░░  Stabilization
  Documentation & Marketing           ████████░░░░░░  Ongoing
```

### Milestone Summary

| Milestone | Version | Date | Description |
|-----------|---------|------|-------------|
| **Alpha** | v0.6.0 | Mar 2026 | Expressions + Actions + Metadata API |
| **Beta** | v0.8.0 | Jun 2026 | i18n + RBAC + Real-time |
| **RC** | v0.9.0 | Sep 2026 | Full feature set + Performance |
| **GA** | v1.0.0 | Dec 2026 | Production-ready enterprise console |

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
│   │   ├── usePermissions.ts   # [Phase 5] RBAC hook
│   │   └── useRealtime.ts      # [Phase 6] WebSocket hook
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

### Phase 1-3 (Foundation)
- [ ] 100% of navigation items respect `visible` expressions
- [ ] All CRUD actions dispatched through typed ActionRunner
- [ ] Console can load app config from server API

### Phase 4-6 (Enterprise)
- [ ] 3+ languages supported with runtime switching
- [ ] Permission-denied UI tested for all object operations
- [ ] Real-time grid refresh on server-side changes

### Phase 7-8 (Performance)
- [ ] Bundle size < 150KB gzipped
- [ ] LCP < 600ms on 3G
- [ ] Console installable as PWA

### Phase 9-10 (Advanced)
- [ ] CSV/Excel import and export working
- [ ] Dashboard drag-and-drop layout
- [ ] Notification center with activity feed

---

## Appendix A: Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Development Plan (v0.1–v0.5) | `apps/console/DEVELOPMENT_PLAN.md` | Completed phases 1-10 |
| Next Steps (v0.5.1+) | `apps/console/NEXT_STEPS.md` | Tactical next tasks |
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
