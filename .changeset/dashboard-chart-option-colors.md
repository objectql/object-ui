---
"@object-ui/plugin-dashboard": patch
"@object-ui/core": patch
"@object-ui/plugin-charts": patch
---

feat(dashboard): dataset chart widgets paint select/lookup dimensions in their option colors

A dashboard `DatasetWidget` chart grouped by a select/lookup dimension (e.g.
project `health`) painted its categories from the generic `--chart-1..5`
palette — the same gap the chart view (`object-chart`) had before #1932. It now
resolves the dimension field's option colors (using the dataset's base `object`
+ dimension→field map the query already returns) and threads them to the
renderer as a per-category `categoryColors` map, so health green/red/yellow
paints semantically.

The value/label→color resolution is extracted into a shared `buildOptionColorMap`
(`@object-ui/core`) now used by both `DatasetWidget` and `ObjectChart`.
