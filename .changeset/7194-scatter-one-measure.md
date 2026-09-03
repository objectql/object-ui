---
'@object-ui/plugin-charts': patch
'@object-ui/i18n': patch
---

A scatter handed more than one series now refuses instead of drawing a false picture.

Scatter binds one measure: `series[0].dataKey` is the y axis, and every series was
handed the same rows through that one axis. A second series therefore added a
colour and a legend entry and nothing else — measured, two series over two rows
painted four symbols at two positions, each drawn twice, and the second measure's
values appeared nowhere on the plot. The data was valid and the picture was
confidently wrong, which no existing refusal could see.

A `chartType: 'scatter'` with two or more `series` now renders the renderer's
refusal shell under `data-chart-error="scatter-multi-series"`, stating that a
scatter plots one measure, naming the fix (keep exactly one series) and listing
the series keys it was handed. A single-series scatter is unchanged.

This refusal counts authored `series` only. `compareTo` on scatter is out of
its scope: objectui#7402 ruled (b) that scatter joins pie / donut / funnel in
excluding `compareTo` — `supportsCompareTo` and the dashboard widget path stop
synthesising a comparison series for it, so no `…__comparison` overlay is ever
built for a scatter and this guard is never reached by a compare-to document.
That exclusion ships as a separate change; until it lands, a `compareTo`
document still reaches the renderer as two series and refuses here today.

No multi-measure projection is built (maintainer ruling, 2026-09-02): nothing
in-repo authors a two-series scatter, so that capability waits for a real caller.
The refusal copy is `chart.scatterOneMeasure` in all ten locale packs.
