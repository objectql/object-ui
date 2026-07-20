---
"@object-ui/plugin-dashboard": patch
---

chore(lint): clear the baseline lint errors in plugin-dashboard (objectui#2713 Wave 3)

First package of Wave 3 in the #2713 lint-gate restoration. `@object-ui/plugin-dashboard`
was red at baseline on `main`; cleared every **error** (no behavior change;
warnings out of scope):

- **`react-hooks/rules-of-hooks`** (`ObjectDataTable`) — `useObjectTranslation`
  was wrapped in try/catch; removed the wrapper (the hook is provider-safe and
  never throws — the #2709 fix). English defaults still stand until a
  translation resolves.
- **`react-hooks/static-components`** (`MetricCard`, `MetricWidget`) —
  `getLazyIcon(name)` returns a module-cached, stable component per name (not a
  component created during render), so the render sites carry a justified scoped
  disable.
- **`no-irregular-whitespace`** (`DatasetWidget`) — the literal U+FEFF BOM
  prepended to the exported CSV blob (Excel UTF-8 detection) is written as the
  `﻿` escape: byte-identical at runtime, no literal irregular-whitespace char.
- **`no-useless-escape`** (`recordFields`) — dropped a needless `\$` inside a
  character class (`[\$¥€£]` → `[$¥€£]`).
- **`no-sparse-arrays`** (`recordFields`) — the `|| [, '']` match fallback is
  written `[undefined, '']` so index 0 is an explicit hole, not a sparse one.
- **`no-useless-assignment`** (`PivotTable`) — the `suffix` accumulator is now a
  single `const` at its one assignment site instead of a dead-initialized `let`.
- **`no-require-imports`** (`DashboardRenderer.designMode` test) — the hoisted
  `vi.mock` factory uses an `async` factory with `await import('react')`.
