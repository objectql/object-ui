---
"@object-ui/plugin-gantt": minor
---

feat(gantt): configurable hover tooltip + live parent-stretch (follow-up to #1672)

- **Configurable tooltip** — a view declares `tooltipFields` on its gantt config
  (field names, or `{ field, label }` to override the label); `ObjectGantt`
  resolves each against the record (select options → label, lookups → embedded
  record name, dates/numbers/currency/percent through the shared `@object-ui/
  fields` formatters) and feeds `GanttView` a `task.fields` array that replaces
  the default hover detail.
- **Live parent-stretch** — a summary bar's displayed range rolls up from its
  children live, so dragging a child past the parent's edge stretches the parent.
- Also replaces six prebuilt-CSS utilities the components stylesheet never emits
  (connector dot `-right-2` was occluding the progress label, resize-handle
  width, progress-fill radius, grid z-index, `sm:` variants) with inline styles
  / a scoped media query so the chart renders correctly in consuming apps.
