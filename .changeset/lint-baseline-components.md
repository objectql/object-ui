---
"@object-ui/components": patch
---

chore(lint): clear the baseline lint errors in components (objectui#2713 Wave 3)

Wave 3 of the #2713 lint-gate restoration. `@object-ui/components` was red at
baseline on `main`; cleared every **error** (no behavior change; warnings out of
scope):

- **`react-hooks/rules-of-hooks`** — `react-page` `ReactKindPage` had a
  capability-gate early return *before* four hooks (incl. a `useEffect` that
  `import()`s the react runtime). Hoisted the hooks above the gate **and guarded
  the import** (`if (!capabilityEnabled) return` inside the effect) so a disabled
  build still never loads the gated runtime; the disabled notice is returned
  after the hooks. Translation helpers in `empty` / `action-bar` / `action-menu`
  unwrap a try/catch around the provider-safe `useObjectTranslation` (the #2709
  fix).
- **`react-hooks/static-components`** — dynamic renderer/icon lookups
  (`ComponentRegistry.get`, `resolveIcon`) in `action-bar` / `action-group` ×2 /
  `action-menu`, and the five `__tests__` helpers that render a registry-resolved
  component, are stable references → justified scoped disables.
- **`react-hooks/purity`** — `ui/sidebar` skeleton width uses `Math.random()`
  once per mount (`useMemo([])`) for a decorative placeholder → justified scoped
  disable.
- **`@typescript-eslint/no-empty-object-type`** — `ShimmerSkeletonProps` empty
  extend → `type` alias.
- **`no-useless-assignment`** — `test-utils` `maxDepth` dead initializer → single
  `const`.
- **`no-require-imports`** — `config-panel-renderer` test uses a top-level
  `import React` instead of an in-test `require`.
- **stale `eslint-disable`** — removed a `jsx-a11y/alt-text` directive in
  `elements` whose plugin is not loaded in the flat config.
