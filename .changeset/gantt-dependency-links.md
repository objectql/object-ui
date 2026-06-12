---
"@object-ui/plugin-gantt": minor
---

Render dependency links in the Gantt timeline (Phase 1 of Gantt feature parity).

`task.dependencies` (already parsed from `dependenciesField` but never drawn) now renders as orthogonal arrows from each predecessor bar to its dependent bar in an SVG overlay. All four MS-Project link types are supported via the new object form `{ id, type }` — `fs` (finish-to-start, default), `ss`, `ff`, `sf` — with backward links routed around the bars. Arrows follow bars live during drag/resize, and hovering a bar highlights its links. `normalizeDependencies` (exported) accepts CSV strings, id arrays, and object arrays with id aliases (`task`/`target`/`_id`) and long-form type aliases (`finish_to_start`, `end-to-end`, …). Colors use theme CSS variables directly so links render correctly with the prebuilt components stylesheet.
