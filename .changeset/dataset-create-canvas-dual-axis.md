---
"@object-ui/app-shell": minor
---

feat(metadata-admin): dataset create opens the rich designer + dual-axis preview

- **Create → rich designer.** `dataset` joins `object` / `report` in
  `CREATE_MODE_CANVAS_TYPES`, so "New dataset" opens the structured designer
  (base-object picker, joins, dimension/measure editors, live preview) instead
  of the degraded generic SchemaForm. `DatasetDefaultInspector` gains a
  create-mode **Name** field that auto-derives a snake_case identifier from the
  label until edited (mirrors `ReportDefaultInspector` / `ObjectDefaultInspector`),
  so a dataset created through the canvas saves with a valid identity instead of
  dead-ending.
- **Mixed-scale preview.** When a dataset preview mixes a ratio/percent measure
  (e.g. `utilization`, `0.0%`) with magnitude measures (currency in the
  hundred-thousands), the ratio measures now plot as a line on a secondary
  (right) Y axis via the existing `combo` chart — they're no longer crushed to an
  invisible sliver beside the large bars. Same-scale selections stay a plain bar
  chart.
