---
"@object-ui/plugin-charts": patch
---

fix(charts): use field option colors for categorical chart dimensions

An `object-chart` grouped by a select/lookup field (e.g. project `health`)
painted its categories from the generic `--chart-1..5` palette, so a "Red"
health slice rendered teal and "Green" rendered blue. The chart now resolves
the category dimension's option colors — both the `objectName` + `groupBy`
path and the dataset path (via the dataset's `object` + dimension `field`) —
and threads them to the renderer as a per-category `categoryColors` map. That
map wins over the positional palette and falls back to it for categories
without an option color, so pie/donut slices and bar cells render in their
semantic colors.
