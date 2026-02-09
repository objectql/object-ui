# ObjectStack Console — Next Steps

> Generated: 2026-02-07  
> Previous: DEVELOPMENT_PLAN.md (10 phases — all complete ✅)

## Audit Summary

After completing the initial 10 phases, a deep audit revealed these **architectural gaps**:

| # | Finding | Impact |
|---|---------|--------|
| A | Console `ObjectView` is 400+ lines of hand-wired logic; the official `plugin-view/ObjectView` (410 lines) is registered but unused | High — duplicated CRUD, no SDUI |
| B | `useExpression` not used anywhere — `visible` fields do simple `=== false` checks instead of expression evaluation | High — conditional rendering broken |
| C | `ContactList.tsx` + `types.ts` are hardcoded legacy components (`client.data.find` directly), unused by current routing | Medium — dead code |
| D | `plugin-view/ObjectView` registration passes `dataSource={null}` — broken unless overridden | Medium — blocks adoption |
| E | Two competing `ActionSchema` interfaces (`crud.ts` vs `ui-action.ts`) — spec v2.0.1 version is orphaned | High — type confusion |
| F | `ActionRunner.execute()` takes `any` — no typed action dispatch, no toast/redirect/dialog handling | Medium — action system is incomplete |
| G | `DataSource` interface has no `getView`/`getApp` — can't fetch UI definitions from server | High — blocks server-driven UI |
| H | `AppShell` has no branding props — `useBranding` hook works around this at app level | Low — works, not ideal |
| I | `ThemeProvider` import is at bottom of App.tsx (below component definitions) | Low — code smell |
| J | No console app documentation in `content/docs/` | Medium — DDD violation |

---

## Phase 11: Dead Code Cleanup 🧹 (Quick — 30 min)

| Task | Description | Files |
|------|-------------|-------|
| 11.1 | Delete `ContactList.tsx` — legacy, unused, violates SDUI pattern | `src/components/ContactList.tsx` |
| 11.2 | Delete `types.ts` — `Contact` interface is unused (only by ContactList) | `src/types.ts` |
| 11.3 | Move `ThemeProvider` import to top of App.tsx (code organization) | `src/App.tsx` |
| 11.4 | Extract `RecordDetailView` from App.tsx into its own file | `src/App.tsx` → `src/components/RecordDetailView.tsx` |
| 11.5 | Gate MSW console.logs behind `import.meta.env.DEV` | `src/mocks/browser.ts` |

**Estimate:** 30 minutes

---

## Phase 12: Expression Engine Integration 🧮 (High — 1 day)

**Goal:** Make `visible`, `disabled`, `hidden` expressions actually work.

| Task | Description | Files |
|------|-------------|-------|
| 12.1 | Import `useExpression` from `@object-ui/react` | Multiple components |
| 12.2 | Replace `item.visible === false` with `useExpression(item.visible)` in `AppSidebar` | `src/components/AppSidebar.tsx` |
| 12.3 | Add `hidden` expression evaluation in `ObjectView` for conditional fields | `src/components/ObjectView.tsx` |
| 12.4 | Add expression context provider with `{ user, app, data }` at app root | `src/App.tsx` |
| 12.5 | Add `visibleOn` support for navigation items per `@objectstack/spec` | `src/components/AppSidebar.tsx` |

**Estimate:** 1 day

---

## Phase 13: Consolidate to Plugin ObjectView 🏗️ (Critical — 2-3 days)

**Goal:** Replace the 400-line hand-wired `ObjectView` in console with the official `plugin-view/ObjectView`. This is the single most impactful refactor — it makes the console truly Server-Driven.

| Task | Description | Files |
|------|-------------|-------|
| 13.1 | Fix `plugin-view/ObjectView` registration to receive `dataSource` from `SchemaRendererProvider` context | `packages/plugin-view/src/index.tsx` |
| 13.2 | Wire `FilterUI` + `SortUI` into `plugin-view/ObjectView` (replace TODO placeholder) | `packages/plugin-view/src/ObjectView.tsx` |
| 13.3 | Add `ViewSwitcher` to `plugin-view/ObjectView` for multi-view support | `packages/plugin-view/src/ObjectView.tsx` |
| 13.4 | Replace console's hand-wired `ObjectView` with `SchemaRenderer` rendering `object-view` type | `apps/console/src/components/ObjectView.tsx` |
| 13.5 | Keep console-specific toolbar additions (MetadataInspector, branding) as wrapper | `apps/console/src/components/ObjectView.tsx` |
| 13.6 | Ensure the CRUD Dialog uses the action system (`useObjectActions`) | `packages/plugin-view/src/ObjectView.tsx` |

**Why:** Currently the console duplicates 80% of what `plugin-view/ObjectView` already does. The plugin version has proper CRUD modals, search, schema fetching — but it's not used.

**Estimate:** 2-3 days

---

## Phase 14: DataSource Metadata API 📡 (Critical — 1-2 days)

**Goal:** Add `getView`, `getApp` methods to the DataSource interface so the console can fetch UI definitions from the server instead of using static config.

| Task | Description | Files |
|------|-------------|-------|
| 14.1 | Add `getView(objectName, viewId)` to `DataSource` interface | `packages/types/src/data-source.ts` |
| 14.2 | Add `getApp(appId)` to `DataSource` interface | `packages/types/src/data-source.ts` |
| 14.3 | Implement `getView` / `getApp` in `ObjectStackAdapter` | `packages/data-objectstack/src/index.ts` |
| 14.4 | Fallback to static config when server doesn't provide UI metadata | `apps/console/src/App.tsx` |
| 14.5 | Add caching for view/app metadata in adapter | `packages/data-objectstack/src/index.ts` |

**Estimate:** 1-2 days

---

## Phase 15: Action System Completion 🎯 (Medium — 2 days)

**Goal:** Unify the two ActionSchema types and make ActionRunner production-ready.

| Task | Description | Files |
|------|-------------|-------|
| 15.1 | Deprecate `crud.ts` ActionSchema; make `ui-action.ts` the canonical one | `packages/types/src/index.ts` |
| 15.2 | Type `ActionRunner.execute()` with `ActionSchema` instead of `any` | `packages/core/src/actions/ActionRunner.ts` |
| 15.3 | Add `toast` action handler (integrate with Sonner/Toast from Shadcn) | `packages/core/src/actions/ActionRunner.ts` |
| 15.4 | Add `dialog` action handler (open confirmation via Shadcn AlertDialog) | New: `packages/react/src/hooks/useActionDialog.ts` |
| 15.5 | Add `redirect` result handling in `useActionRunner` | `packages/react/src/hooks/useActionRunner.ts` |
| 15.6 | Wire action buttons into ObjectView toolbar from config | `apps/console/src/components/ObjectView.tsx` |

**Estimate:** 2 days

---

## Phase 16: App Shell Branding 🎨 (Medium — 1 day)

**Goal:** Move branding from the console's `useBranding` hook into the `@object-ui/layout` AppShell so all apps get it for free.

| Task | Description | Files |
|------|-------------|-------|
| 16.1 | Add `branding` prop to `AppShell` (logo, primaryColor, title) | `packages/layout/src/AppShell.tsx` |
| 16.2 | Apply CSS custom properties inside AppShell (move logic from useBranding) | `packages/layout/src/AppShell.tsx` |
| 16.3 | Console's `useBranding` becomes a thin wrapper over AppShell's built-in | `apps/console/src/hooks/useBranding.ts` |
| 16.4 | Update `ConsoleLayout` to pass `activeApp.branding` to AppShell | `apps/console/src/components/ConsoleLayout.tsx` |

**Estimate:** 1 day

---

## Phase 17: Console Documentation 📚 (Medium — 1 day)

**Goal:** Per Rule #2 (Documentation Driven Development), create console app docs.

| Task | Description | Files |
|------|-------------|-------|
| 17.1 | Create getting-started guide for running the console | `content/docs/guide/console.md` |
| 17.2 | Document the console architecture (data flow, routing, MSW mock) | `content/docs/guide/console-architecture.md` |
| 17.3 | Add JSDoc headers to all console components | `apps/console/src/components/*.tsx` |
| 17.4 | Update root `README.md` with console quickstart section | `apps/console/README.md` |

**Estimate:** 1 day

---

## Phase 18: Test Coverage 🧪 (Ongoing)

**Goal:** The 20 existing test files need to be audited — some may be broken after all the refactoring.

| Task | Description | Files |
|------|-------------|-------|
| 18.1 | Run all existing tests and fix failures | `vitest` |
| 18.2 | Add test for `CommandPalette` keyboard shortcut | `src/__tests__/CommandPalette.test.tsx` |
| 18.3 | Add test for `ErrorBoundary` recovery | `src/__tests__/ErrorBoundary.test.tsx` |
| 18.4 | Add test for `useBranding` CSS variable injection | `src/__tests__/useBranding.test.tsx` |
| 18.5 | Add test for `useObjectActions` handlers | `src/__tests__/useObjectActions.test.tsx` |

**Estimate:** 1-2 days

---

## Execution Order

```
Phase 11 (cleanup)        → 30 min  ← Quick Win, remove dead code
Phase 12 (expressions)    → 1 day   ← Unblock conditional UI
Phase 13 (plugin OV)      → 2-3 days← THE key refactor — true SDUI
Phase 14 (metadata API)   → 1-2 days← Server-driven data
Phase 15 (action system)  → 2 days  ← Type safety + toast/dialog
Phase 16 (app shell)      → 1 day   ← Package-level branding
Phase 17 (docs)           → 1 day   ← DDD compliance
Phase 18 (tests)          → 1-2 days← Quality gate
```

**Total: ~10 days for Phases 11-18**

---

## Priority Matrix

| Priority | Phase | Reason |
|----------|-------|--------|
| 🔴 Critical | Phase 13 | Eliminates 400 lines of duplication, makes console truly SDUI |
| 🔴 Critical | Phase 14 | Unblocks server-driven metadata; without it, console is static-config-only |
| 🟡 High | Phase 12 | Expression engine is the core of SDUI conditional rendering |
| 🟡 High | Phase 15 | Action system type safety affects every interactive component |
| 🟢 Medium | Phase 11 | Dead code is confusing but harmless |
| 🟢 Medium | Phase 16 | useBranding works, just not in the ideal package |
| 🟢 Medium | Phase 17 | Missing docs slow down contributors |
| 🔵 Low | Phase 18 | Tests can be added incrementally |
