# Gantt Plugin Roadmap — Feature Parity (vs SVAR React Gantt)

> **Status:** Planned. Gap analysis done (June 2026) against [SVAR React Gantt](https://github.com/svar-widgets/react-gantt).
> Current `@object-ui/plugin-gantt` is a draggable day-scale bar chart; it lacks the project-management
> semantics (dependencies, hierarchy, milestones, real time scales) that define a Gantt chart.
> SVAR core is GPLv3 — feature reference only, no code reuse (we are MIT).
>
> Tracked from the main [ROADMAP.md](../../ROADMAP.md) § P2.11.

## What we already have

Bar drag/resize with day snapping + optimistic persistence, pinch-to-zoom, responsive/mobile pass,
Today marker + jump-to-today, weekend highlighting, semantic color fallback, i18n, inline edit
(double-click), record detail drawer on click, delete confirmation.

## Phase 1 — Dependency Links Rendering (highest ROI) ✅

- [x] Render dependency arrows as an SVG overlay in `GanttView` (orthogonal elbow routing, arrowhead markers, backward-link detour)
- [x] Support the 4 link types: finish-to-start (default), start-to-start, finish-to-finish, start-to-finish — per-dependency `{ id, type }` object form; `normalizeDependencies` accepts CSV strings, id arrays, object arrays with id/type aliases
- [x] Recompute arrow paths live during bar drag/resize preview
- [x] Highlight a task's links on hover (and while dragging)
- [x] Tests: link parsing (string id, array, `{id, type}` object), path anchors per type, hover highlight, drag re-render, backward links (8 new GanttView tests + 6 normalizeDependencies tests)

## Phase 2 — Real Time Scales (resurrect `viewMode`) ✅

- [x] Implement day/week/month/quarter column generation in `timeColumns` — calendar-true column widths over one linear ms→px mapping (`pxPerDay = columnWidth / nominalDays`), so bars, grid, links and the Today marker stay aligned in every mode
- [x] Two-row scale header: month groups over day/week units, year groups over month/quarter units
- [x] Restore the view-mode segmented control in the toolbar; zoom buttons fall through to the next coarser/finer granularity at min/max column width
- [x] Drag snapping respects active granularity (day/week columns, calendar-clamped month/quarter shifts preserving duration on move)
- [x] Tests: column generation per mode, header groups/labels, bar geometry per granularity, week + month snap behavior (8 new tests)

## Phase 3 — Task Hierarchy & Types ✅

- [x] `parentField` (+ `task.parent`) → task tree, depth-indented rows, expand/collapse chevrons in the task list; orphans and parent cycles surface as roots instead of dropping rows
- [x] Summary (parent) bars: bracket-style slim bar with end caps spanning the children rollup range; read-only (children drive it)
- [x] Milestone type: diamond marker via `typeField`/`task.type` or the `end <= start` heuristic; movable, not resizable; links anchor at the diamond center
- [x] Auto-rollup: summary dates = min/max of descendants, progress = duration-weighted child progress (client-side, display via `data-progress`)
- [x] Tests: tree building, orphan + cycle handling, collapse hides rows/links, summary range/progress math, milestone rendering + link anchors (9 new tests)

## Phase 4 — Interaction Polish

- [ ] Progress drag handle on the bar (currently progress is editable only via double-click inline edit)
- [ ] Rich hover tooltip (title, dates, duration, progress, assignee) replacing the bare percentage label
- [ ] Context menu on bar/row (edit, delete, add dependency, convert to milestone)
- [ ] Keyboard support: arrow-key row navigation, Enter to open, Delete to delete; WCAG roles on grid/timeline
- [ ] Drag-to-create dependency (drag from bar edge connector dot to another bar)
- [ ] Row drag-to-reorder (persist via sort field when configured)

## Phase 5 — Scale & Performance

- [ ] Virtualized row rendering (windowing) for both task list and timeline — currently full `tasks.map()`, target 5k+ tasks
- [ ] Virtualized/segmented timeline columns for multi-year ranges
- [ ] Fullscreen mode toggle
- [ ] Custom vertical markers (deadline lines, sprint boundaries) beyond the Today marker

## Phase 6 — Advanced (SVAR PRO territory, differentiators)

- [ ] Critical path computation + slack visualization
- [ ] Baselines (planned vs actual bars)
- [ ] Auto-scheduling: dependency-driven date shifting (forward, finish-to-start first)
- [ ] Working calendar (skip weekends/holidays in duration math)
- [ ] Undo/redo for drag/edit operations
- [ ] Export: PNG/PDF (client-side), MS Project XML import/export
