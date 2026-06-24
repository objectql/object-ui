---
"@object-ui/types": patch
---

feat(types): type `object-chart` `colors` as a palette OR a value→color map

`ObjectChartSchema.colors` now accepts either a positional palette (`string[]`)
or an explicit value→color map (`Record<value, color>`, kanban-style). This
matches the chart renderer, which resolves a select/lookup dimension's option
colors per category and lets them (and any explicit map) win over the
positional palette — so health green/red/yellow paints semantically.
