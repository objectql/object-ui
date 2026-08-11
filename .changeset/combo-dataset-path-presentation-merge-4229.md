---
'@object-ui/plugin-dashboard': patch
---

Dashboard `combo` widgets draw as combos on the dataset path — the dataset owns the data, the author owns the presentation

A widget authoring the spec's own combo shape — `series[].type` plus `series[].yAxis: 'left'|'right'` and two `yAxis` entries — rendered as two bar series on one shared axis. Measured in the DOM: 2 bars, 0 lines, 1 y-axis, where 1 bar, 1 line and 2 axes were authored, so a percentage measure was plotted against a raw count's scale.

Two halves caused it, and fixing either alone leaves a worse state than before. `CHART_TYPE_MAP` had no `combo` entry, so a `combo` widget fell through its `?? 'bar'` default — bars, whatever the series said. And `chartConfigPresentation` refused to forward `series` / `xAxis` / `yAxis` at all, on the stated grounds that they are derived from the dataset selection, so the per-series mark and the axis binding could never reach the renderer even once the family resolved.

That belief was half right. The dataset does own the series MEMBERSHIP — which columns become series, which rows, which buckets — and it still does: an authored entry naming a measure the dataset did not select is ignored, and a derived series the author said nothing about keeps the family default. What the dataset never owned is the PRESENTATION carried on those same objects: the per-series mark, its left/right axis binding, label, colour, stack, and the axis definitions' title, format, min, max, step, grid and position. Those are the author's, and they now merge onto the derived bindings by name/key match with the explicit binding winning — one merge function, not a spread per attribute. The split runs through the two binding keys: `ChartSeries.name` and `ChartAxis.field` name a column and stay with the dataset; everything else on the object travels.

This is objectui#2880's S2 rule, which PR #2883 landed in `ObjectChart` and which the dataset path never carried over. Dropping `ChartAxis.field` on the way through is what makes forwarding the axes safe rather than merely guarded: it is the one key by which an authored axis could have named a series, since the renderer synthesises series from `yAxis[].field` when a chart declares none.

Two consequences beyond the reported bug. A non-combo widget can now declare one line series and get the combo the renderer already knew how to derive from disagreeing series types. And a `compareTo` overlay inherits its own measure's mark and axis, so the comparison of a bar-on-the-left measure no longer draws as a line on the right the moment the chart becomes a combo.

Dashboards that never authored `chartConfig.series` or `chartConfig.yAxis` emit exactly what they emitted before.
