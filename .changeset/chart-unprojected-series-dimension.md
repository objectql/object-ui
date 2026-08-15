---
'@object-ui/plugin-charts': patch
---

A grouped chart whose SECOND dimension was never projected says so instead of
drawing an empty frame.

"Cannot know refuses loudly" was answered on the first dimension only.
`AdvancedChartImpl`'s `hasNoCategoryKey` (framework#4033) names an unprojected
x-axis dimension rather than drawing a bare axis; the series axis had no
counterpart, so a pivot whose second dimension was absent from the result rows
produced `series: []` and rendered axes, grid, tooltip and legend around zero
marks — indistinguishable, to the author, from "no data matched".

Such a chart now renders the same explanatory placeholder
(`data-chart-error="no-plottable-series"`) and logs the same diagnostic pair the
category-axis guard logs: the axis it did plot, and the keys its rows actually
carry.

The three-way distinction is unchanged and pinned: null / empty-string group
values still DRAW (they are real groups with real buckets), a partially
projected group key still draws what projects — mirroring the category axis,
which refuses only when NOT ONE row carries the key — and an ordinary pivot
renders unchanged. The refusal is limited to the families whose marks come from
`series` and nothing else (bar, horizontal-bar, line, area, combo); pie, donut,
funnel, radar and scatter draw from a `value` column with no series declared, so
they are untouched. A caller that computed no series binding at all
(`series === undefined`) is also untouched.
