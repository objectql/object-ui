# ObjectStack Console — Next Steps

> Generated: 2026-02-07  
> Updated: 2026-02-13  
> Previous: DEVELOPMENT_PLAN.md (10 phases — all complete ✅)

## Audit Summary — All Resolved ✅

After completing the initial 10 phases, a deep audit revealed architectural gaps. **All have been resolved:**

| # | Finding | Resolution |
|---|---------|------------|
| A | Console ObjectView was hand-wired | ✅ Now uses `plugin-view/ObjectView` via `PluginObjectView` |
| B | `useExpression` not used | ✅ `evaluateVisibility` + `ExpressionProvider` wired into navigation, sidebar, CRUD dialog |
| C | `ContactList.tsx` + `types.ts` dead code | ✅ Removed |
| D | `plugin-view/ObjectView` passes `dataSource={null}` | ✅ Fixed — receives dataSource from context |
| E | Two competing `ActionSchema` interfaces | ✅ Unified to `ActionDef` in `@object-ui/core` |
| F | `ActionRunner.execute()` takes `any` | ✅ Typed with `ActionDef` |
| G | `DataSource` has no `getView`/`getApp` | ✅ Added `getView`, `getApp`, `getPage` |
| H | `AppShell` has no branding props | ✅ `AppShell` now has `branding` prop with CSS custom properties |
| I | `ThemeProvider` import at bottom | ✅ Reorganized |
| J | No console docs in `content/docs/` | ✅ `console.md` + `console-architecture.md` added |

---

## Phase 11: Dead Code Cleanup ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 11.1 | Delete `ContactList.tsx` | ✅ Removed |
| 11.2 | Delete `types.ts` | ✅ Removed |
| 11.3 | Move `ThemeProvider` import to top of App.tsx | ✅ Done |
| 11.4 | Extract `RecordDetailView` into its own file | ✅ Done |
| 11.5 | Gate MSW console.logs behind `import.meta.env.DEV` | ✅ Done |

---

## Phase 12: Expression Engine Integration ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 12.1 | Import `evaluateVisibility` from ExpressionProvider | ✅ Done |
| 12.2 | Replace visible checks with expression evaluation in AppSidebar | ✅ Done |
| 12.3 | Add expression evaluation in CRUD dialog for field visibility | ✅ Done |
| 12.4 | Add ExpressionProvider with { user, app, data } at app root | ✅ Done |
| 12.5 | Add `visibleOn` support for navigation items | ✅ Done |

**Estimate:** 1 day

---

## Phase 13: Consolidate to Plugin ObjectView ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 13.1 | Fix plugin-view ObjectView registration to receive dataSource from context | ✅ Done |
| 13.2 | Wire FilterUI + SortUI into plugin-view ObjectView | ✅ Done |
| 13.3 | Add ViewSwitcher to plugin-view ObjectView | ✅ Done |
| 13.4 | Console ObjectView uses PluginObjectView | ✅ Done |
| 13.5 | Console-specific toolbar (MetadataInspector, design mode) as wrapper | ✅ Done |
| 13.6 | CRUD Dialog uses useObjectActions | ✅ Done |

---

## Phase 14: DataSource Metadata API ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 14.1 | `getView(objectName, viewId)` on DataSource interface | ✅ Done |
| 14.2 | `getApp(appId)` on DataSource interface | ✅ Done |
| 14.3 | Implement in ObjectStackAdapter with MetadataCache | ✅ Done |
| 14.4 | Fallback to static config | ✅ Done (objectstack.shared.ts) |
| 14.5 | Caching for view/app metadata | ✅ Done |

---

## Phase 15: Action System Completion ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 15.1 | Canonical ActionDef type | ✅ Done |
| 15.2 | Typed `ActionRunner.execute()` with ActionDef | ✅ Done |
| 15.3 | Toast action handler (Sonner) | ✅ Done |
| 15.4 | Dialog confirmation handler | ✅ Done |
| 15.5 | Redirect result handling | ✅ Done (navigate handler) |
| 15.6 | Schema-driven toolbar actions | ✅ Done (`objectDef.actions[]`) |

---

## Phase 16: App Shell Branding ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 16.1 | `branding` prop on AppShell | ✅ Done (`AppShellBranding` interface) |
| 16.2 | CSS custom properties in AppShell | ✅ Done (`useAppShellBranding`) |
| 16.3 | Console useBranding simplified | ✅ Done |
| 16.4 | ConsoleLayout passes branding to AppShell | ✅ Done |

---

## Phase 17: Console Documentation ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 17.1 | Getting-started guide | ✅ Done (`content/docs/guide/console.md`) |
| 17.2 | Architecture documentation | ✅ Done (`content/docs/guide/console-architecture.md`) |
| 17.3 | JSDoc headers on components | ✅ Done |
| 17.4 | Console README.md | ✅ Done |

---

## Phase 18: Test Coverage ✅ Complete

| Task | Description | Status |
|------|-------------|--------|
| 18.1 | Run all tests and fix failures | ✅ Done (34 test files, 260+ tests passing) |
| 18.2 | Expression visibility tests | ✅ Done (`ExpressionVisibility.test.tsx`) |
| 18.3 | Error boundary tests | ✅ Done |
| 18.4 | WCAG contrast tests | ✅ Done |
| 18.5 | Accessibility tests | ✅ Done |

---

## Execution Summary

All 8 phases (11-18) are complete. The console has evolved from a prototype to a production-ready
SDUI engine with:

- **34 test files** covering core flows, plugins, accessibility, and expressions
- **260+ passing tests** with only development-environment-specific skips
- **Full SDUI architecture**: Plugin-based rendering, expression-driven visibility, typed action system
- **Enterprise features**: i18n (10 languages), RBAC, real-time, PWA, performance optimization
- **All 8 view plugins** support NavigationConfig specification (7 modes)
