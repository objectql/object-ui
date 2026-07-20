---
"@object-ui/i18n": patch
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-view": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-charts": patch
"@object-ui/plugin-report": patch
"@object-ui/layout": patch
"@object-ui/collaboration": patch
---

chore(lint): clear the baseline lint errors in nine more packages (objectui#2713 Wave 2)

Second wave of the #2713 lint-gate restoration (after #2730). These nine package
lints were red at baseline on `main`, so their per-package `lint` gate could not
catch new violations. Cleared every **error** (no behavior change; warnings out
of scope):

- **`react-hooks/rules-of-hooks`** (`i18n`, `plugin-grid`, `plugin-view`,
  `plugin-list`) — translation helpers (`useSafeFieldLabel`,
  `useRowActionTranslation`, `useViewLabel`, `useViewTabLabel`, `useMoreLabel`)
  wrapped a provider-safe hook (`useObjectTranslation`/`useObjectLabel`, which
  never throw) in try/catch; removed the wrapper (the same fix #2709 applied in
  fields). `plugin-kanban` `ObjectKanban` moved its `if (error)` early return
  below the `useCallback` so hooks run unconditionally. `collaboration`
  `__unsafe_usePresenceContext` keeps its deliberate danger-prefix name via a
  justified scoped disable.
- **`react-hooks/static-components`** (`layout`, `plugin-list`, `plugin-report`)
  — dynamic-icon / registry lookups (`resolveIcon`, `useRegistryComponent`) are
  stable component references, not components created during render → scoped
  disable with justification. `plugin-charts` `TreemapCell` was a *genuine*
  inline component and is hoisted to module scope (it is purely props-driven).
- **`no-irregular-whitespace`** (`plugin-grid` `ImportWizard`) — the literal
  U+FEFF BOM prepended to exported CSV/text blobs (so Excel detects UTF-8) is
  now written as the `﻿` escape: byte-identical at runtime, no literal
  irregular-whitespace character in source.
- **`no-useless-assignment`** (`plugin-grid` `BulkActionDialog`) — dropped a
  dead `= null` initializer that the exhaustive `switch` (incl. `default`)
  overwrites before it is read.
- **`no-unsafe-function-type`** (`plugin-view` `ViewTabBar`) — the dnd-kit
  render-prop `listeners` map is typed `Record<string, (...args: any[]) => void>`
  instead of bare `Function`.
- **`no-require-imports`** (`plugin-kanban`, `plugin-view` tests) — hoisted
  `vi.mock` factories use an `async` factory with `await import('react')`.
