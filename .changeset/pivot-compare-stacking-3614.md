---
"@object-ui/plugin-dashboard": patch
---

Show the `compareTo` comparison in a dataset pivot cross-tab instead of dropping it

A dataset widget with `type: 'pivot'` and two or more `dimensions` renders a true cross-tab, and that branch was the one render path the `compareTo` work left out (objectui#3614, following objectui#3337 / PR #3612). It laid out its columns as `bucket × measure` and never admitted the `<measure>__compare` columns the executor returns — so a pivot with a bounded date window and a `compareTo` ran a correct comparison query, received correct comparison data, and displayed none of it: headers, cells and all three subtotals were silent.

The comparison is now **stacked inside the cell** — current value on top, comparison value and its delta percentage beneath in smaller type:

- The pivot's column structure is unchanged. Giving the comparison a column of its own would turn `bucket × measure` into `bucket × measure × window`, doubling the width and adding a third header level on the widget family whose width is already the scarce resource.
- **Row, column and grand subtotals stack it the same way.** A Total that alone showed no comparison would read as "this row has none", which is a different and false statement.
- One caption names the comparison window ("vs last year") for the whole table, from the same `dashboard.trend.*` vocabulary the KPI and flat-table paths use, and the delta comes from the same helper — so a KPI and a cross-tab cell comparing the same two windows agree on sign and rounding.
- **CSV export stays data-shaped.** The cross-tab now exports a flat `<measure>__compare` column per compared measure, with bare numbers in the cells: a spreadsheet can compute on the export, and no stacked display string ("$120 $100 20%") ever reaches it.

Presence is detected from the returned data, as on every other path, so there is no new option to set — and a pivot the executor sent no comparison for renders exactly as it did before.
