---
"@object-ui/app-shell": patch
---

feat(app-shell): testability ratchet — ban synthetic-event triggers (ADR-0054 Phase 5)

Locks in the testability contract so it can't regress. A conformance test (in the
gating `pnpm test` job) fails the build if a new synthetic-event trigger
(`dispatchEvent(new KeyboardEvent/MouseEvent/PointerEvent)`) appears anywhere in
`packages/*/src` or `apps/*/src`; a matching local ESLint rule
(`object-ui/no-synthetic-event-trigger`) flags it in-editor. The last two
offenders — the sidebar swipe-to-open gestures (`UnifiedSidebar`, `AppSidebar`)
— are converted to a direct, idempotent `setOpenMobile(true)` (C1), so the tree
is clean at zero. Completes the ADR-0054 rollout.
