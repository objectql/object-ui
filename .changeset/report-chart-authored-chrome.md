---
'@object-ui/plugin-report': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/core': patch
---

fix(plugin-report): forward the chart chrome and series presentation `ReportChartSchema` declares (objectui#4877)

A report's embedded chart forwarded exactly six keys to the registered chart
component — `chartType`, `data`, `height`, `isAnimationActive`, `series`,
`xAxisKey`. Everything else `ReportChartSchema` declares as authorable never
left the report renderer, so it was inert metadata: the author writes it, the
schema accepts it, nothing reads it.

`showLegend` was the sharpest case because dropping it does not merely ignore
the author, it INVERTS them: `AdvancedChartImpl` computes
`legendVisible = showLegend !== false`, so an absent value means the legend is
on and an explicit `showLegend: false` still drew one.

Now lowered, under objectui#4229's ruled data/presentation split:

- chrome — `showLegend`, `showDataLabels`, `colors` (both the positional-palette
  array and the per-category record), `subtitle`, `description`, `annotations`,
  `interaction`, `height`;
- per-series presentation — `color`, `stack`, `type`, `yAxis`, `dashArray`,
  `opacity`, `variant`, matched by `series[].name` so series MEMBERSHIP stays
  with the dataset.

`title` is deliberately not forwarded: the report renderer paints it as its own
heading above the plot, and forwarding it would draw a second one inside the
chart's frame. `aria` is not lowered either — nothing on this path reads it
(`AdvancedChartImpl` has no `aria` prop, and this renderer hands the component a
schema directly rather than through `SchemaRenderer`'s flat ARIA injection), so
forwarding it would move declared-but-unread one layer down.

The two helpers (`chartConfigPresentation`, `mergeAuthoredPresentation`) moved
from `plugin-dashboard`'s `DatasetWidget` to `@object-ui/core` beside
`buildChartSeries`, the derivation they merge onto, so both surfaces lower one
vocabulary once instead of keeping a second copy (the duplication objectui#4389
filed as a defect). `@object-ui/core` additionally exports `mergeAuthoredSeries`
— the series merge alone — for a surface whose axes are bare dimension/measure
NAME strings rather than spec `ChartAxis` objects, which is what a report chart
declares. `DatasetWidget` re-exports both names, so its public surface and its
rendering are unchanged.
