---
"@object-ui/plugin-gantt": minor
---

Gantt feature parity, Phases 1–5: dependency links, real time scales, hierarchy, interaction polish, and virtualization.

- **Dependency links** — `task.dependencies` renders as orthogonal arrows in an SVG overlay, with all four MS-Project link types (`fs`/`ss`/`ff`/`sf`) via the object form `{ id, type }`. Arrows follow bars live during drag/resize; hovering a bar highlights its links. `normalizeDependencies` (exported) accepts CSV strings, id arrays, and object arrays with id/type aliases. New dependencies can be created by dragging from a bar's link dot onto another bar (`onDependencyCreate`).
- **Real time scales** — day/week/month/quarter modes with a two-row header (group row + unit row), weekend tinting, zoom in/out, and a jump-to-today button.
- **Hierarchy** — `parent` builds a tree: collapsible summary rows with bracket-style summary bars aggregated from descendants, milestone diamonds, indent guides, and `aria-expanded`/`role="treeitem"` semantics. Dragging a summary bar moves its whole subtree by the same offset (live preview + one `onTaskUpdate` per task); the summary's displayed range rolls up from children, so moving a child past the parent's edge stretches the parent automatically.
- **Interaction polish** — progress drag handle, hover tooltip, context menu (including delete), keyboard navigation/editing, inline title editing, and row drag-reorder (`onTaskReorder`).
- **Scale** — virtualized rows *and* columns (spacer-based windowing; only the visible window is in the DOM, verified: 5,000 tasks render in ~27 ms with 26 rows in the DOM), a fullscreen toggle, and custom timeline `markers` (`{ date, label?, color? }`).

Colors that the prebuilt components stylesheet doesn't emit utilities for use theme CSS variables inline, so everything renders correctly in consuming apps.
