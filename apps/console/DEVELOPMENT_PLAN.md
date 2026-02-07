# ObjectStack Console — Development Plan

> Generated: 2026-02-07  
> Status: **Complete** ✅ (All 10 phases executed)

## Current State

The console is a working prototype that merges 3 example configs (CRM + Todo + KitchenSink) and runs in the browser via MSW mock server. It demonstrates multi-app routing, CRUD, views, dashboards, reports, and pages.

**Key Gaps vs ObjectStack Best Runtime:**
- Lightweight local `ObjectStackDataSource` instead of official `@object-ui/data-objectstack` adapter
- Custom `defineConfig()` instead of `defineStack()` from `@objectstack/spec`
- Chinese UI strings violating English-only rule
- Missing plugin registrations (plugin-view, plugin-form, plugin-dashboard, plugin-report, plugin-markdown)
- Hardcoded view tabs instead of schema-driven `ViewSwitcher`
- No runtime metadata fetching (all static config)
- MSW workarounds that should be fixed upstream
- Duplicated MetadataInspector code across all view components

---

## Phase 1: Data Layer Upgrade ⚡ (Critical)

**Goal:** Replace the lightweight local adapter with the official `@object-ui/data-objectstack` package.

| Task | Description | Files |
|------|-------------|-------|
| 1.1 | Replace `ObjectStackDataSource` with `ObjectStackAdapter` | `src/App.tsx`, `src/dataSource.ts` |
| 1.2 | Add connection state monitoring UI | New: `src/components/ConnectionStatus.tsx` |
| 1.3 | Server-driven metadata fetching (objects, views) | `src/App.tsx` |
| 1.4 | Server-driven view resolution via `client.meta.getView()` | `src/components/ObjectView.tsx` |

**Estimate:** 1-2 days

---

## Phase 2: English-Only Codebase 🌐 (Quick Win)

**Goal:** Remove all Chinese strings per Rule #-1.

| Task | Description | File |
|------|-------------|------|
| 2.1 | Fix breadcrumb labels: 仪表盘→Dashboard, 页面→Page, 报表→Report, 记录→Record | `src/components/AppHeader.tsx` |
| 2.2 | Fix search placeholder: 搜索...→Search... | `src/components/AppHeader.tsx` |

**Estimate:** 30 minutes

---

## Phase 3: Plugin Registration 🧩 (Quick Win)

**Goal:** Ensure all plugins are registered via side-effect imports in one central place.

| Task | Description | File |
|------|-------------|------|
| 3.1 | Add `import '@object-ui/plugin-view'` | `src/main.tsx` |
| 3.2 | Add `import '@object-ui/plugin-form'` | `src/main.tsx` |
| 3.3 | Add `import '@object-ui/plugin-dashboard'` | `src/main.tsx` |
| 3.4 | Add `import '@object-ui/plugin-report'` | `src/main.tsx` |
| 3.5 | Add `import '@object-ui/plugin-markdown'` | `src/main.tsx` |

**Estimate:** 30 minutes

---

## Phase 4: Config Alignment with `@objectstack/spec` 📜 (High)

**Goal:** Use standard spec factories instead of custom config helpers.

| Task | Description |
|------|-------------|
| 4.1 | Replace custom `defineConfig()` with `defineStack()` from `@objectstack/spec` |
| 4.2 | Validate merged config at bootstrap using Zod schemas |
| 4.3 | Remove local `src/config.ts` in favor of spec-standard patterns |

**Estimate:** 1 day

---

## Phase 5: MSW Runtime Fixes 🔧 (Medium)

| Task | Description |
|------|-------------|
| 5.1 | Fix PluginLoader method stripping (upstream) |
| 5.2 | Remove `process.on` polyfill hack |
| 5.3 | Fix discovery endpoint patching in App.tsx |
| 5.4 | Delegate data seeding to AppPlugin |

**Estimate:** 1 day

---

## Phase 6: Schema-Driven Architecture 🎨 (Medium)

| Task | Description |
|------|-------------|
| 6.1 | Use `ViewSwitcher` component from `@object-ui/plugin-view` in ObjectView |
| 6.2 | Wire up `FilterUI` and `SortUI` components in ObjectView |
| 6.3 | Pass `dataSource` to DashboardRenderer |
| 6.4 | Create schema-driven `CrudDialog` using Action System pattern |

**Estimate:** 2-3 days

---

## Phase 7: Layout System Upgrade 🏠 (Medium)

| Task | Description |
|------|-------------|
| 7.1 | Consume `ThemeSchema` tokens from spec |
| 7.2 | Apply CSS custom properties from `app.branding.primaryColor` |
| 7.3 | Support `header` and `empty` layout modes |
| 7.4 | Improve mobile-responsive AppShell |

**Estimate:** 1-2 days

---

## Phase 8: Navigation & Routing 🧭 (Medium)

| Task | Description |
|------|-------------|
| 8.1 | Deep-link support with query param preservation |
| 8.2 | Navigation guards with `visibleOn` expression evaluation |
| 8.3 | `Cmd+K` command palette for quick navigation |

**Estimate:** 1 day

---

## Phase 9: Action System 🎯 (Low — Future Foundation)

| Task | Description |
|------|-------------|
| 9.1 | Implement `ActionEngine` in `@object-ui/core` |
| 9.2 | Wire up button actions via `ActionSchema` |
| 9.3 | Support `navigate`, `validate`, `submit` action types |

**Estimate:** 2-3 days

---

## Phase 10: Developer Experience 🛠️ (Ongoing)

| Task | Description |
|------|-------------|
| 10.1 | Extract shared `MetadataInspector` component |
| 10.2 | Hot-reload on config changes |
| 10.3 | Add React Error Boundaries per route |
| 10.4 | Integration tests with Vitest + MSW |

**Estimate:** Ongoing

---

## Execution Order

```
Phase 2 (i18n)         → 30 min   ← Quick Win
Phase 3 (plugins)      → 30 min   ← Quick Win
Phase 4 (spec config)  → 1 day    ← Spec Compliance
Phase 1 (data layer)   → 1-2 days ← Critical Foundation
Phase 6 (schema-driven)→ 2-3 days ← Main Feature Work
Phase 10 (DX)          → 1 day    ← Code Quality
Phase 5 (MSW fixes)    → 1 day    ← Upstream
Phase 7 (layout)       → 1-2 days ← Polish
Phase 8 (navigation)   → 1 day    ← Polish
Phase 9 (actions)      → 2-3 days ← Architecture
```

**Total: ~2 weeks for Phases 1-8**
