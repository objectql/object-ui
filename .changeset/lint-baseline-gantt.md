---
"@object-ui/plugin-gantt": patch
---

chore(lint): clear the baseline lint errors in plugin-gantt (objectui#2713 Wave 3)

Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-gantt` was red at
baseline on `main`; cleared every **error** (no behavior change; warnings out of
scope). 18 of the 21 were in the demo harness:

- **`react-hooks/static-components` (demo, ×8)** — the `Swatch` legend cell was
  defined inside `ManufacturingLegend`; hoisted to module scope (purely
  props-driven, so nothing from render scope is captured).
- **`react-hooks/rules-of-hooks` (demo, ×9)** — `App` had a `?quickfilter=1`
  early return before ~9 hooks; moved that route below all hooks so hook order
  is stable (the quick-filter branch renders `<QuickFilterDemo />` regardless).
- **`react-hooks/purity` (demo, ×1)** — the demo render-timer necessarily reads
  `performance.now()` during render (paired with an effect that measures elapsed
  ms); justified scoped disable, demo-only.
- **`object-ui/no-synthetic-event-trigger`** (`GanttView.interactions.test`) —
  the Escape-closes-menu test dispatched a raw `window` `KeyboardEvent`; switched
  to `fireEvent.keyDown(window, { key: 'Escape' })` (the pattern already used
  elsewhere in the same file). The window-level Escape listener behaves
  identically.
- **`no-useless-assignment`** (`GanttView`, `ObjectGantt`) — dropped two dead
  initializers (`ok`, `options`) that their exhaustive `try`/`catch` and
  `if`/`else` branches overwrite before reading.
