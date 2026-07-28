---
"@object-ui/plugin-charts": minor
"@object-ui/components": patch
---

feat(charts): ObjectChart honors the spec `ChartConfig` author shape (objectui#2880 / framework#3729)

`ChartConfigSchema` is the chart protocol, but the renderer only ever read a
Recharts-flavoured internal shape — `chartType`, `xAxisKey`, `series[].dataKey`.
Everything an author wrote in the SPEC shape reached the renderer and was
silently dropped, which is exactly what ADR-0078 forbids. framework#3725
documented the gap by trimming the published contract down to the props that
actually worked; this closes it the other way round.

**S1 — one normalization boundary.** `normalizeChartSchema` translates the
author shape into the internal pipeline contract in a single place, rather than
scattering `??` fallbacks through the render tree (framework PD #12: one
translation is a contract mapping, N fallbacks are a second dialect):

- `type` → `chartType`, `xAxis: { field }` → `xAxisKey`, `series: [{ name }]` →
  `series: [{ dataKey }]`
- the report surface's bare-string `xAxis`/`yAxis` resolve too
- `yAxis: [{ field }]` alone plots, with no `series` declared
- **internal props win**, so `DashboardRenderer`, `ObjectView` and the dataset
  path are byte-for-byte unaffected — there is no migration

**The `type` collision.** `ChartConfig.type` is the chart family, but on any
surface that flattens chart config into a props bag `type` is already the SDUI
envelope's component discriminator. Spreading props last let an author's
`type="bar"` replace `object-chart` so the block stopped resolving; stamping the
discriminator last ate the author's value instead. The react-page wrapper now
keeps both: the discriminator wins the `type` slot and the author's value is
preserved beside it as `specType`, which the normalizer reads back.

**S2 — axis presentation.** `ChartAxis.format` drives the tick formatter (via
`Intl.NumberFormat`, no new dependency), `min`/`max` pin the domain,
`logarithmic` swaps the scale, `title` labels the axis, and `showGridLines` is
honored. A second `yAxis` entry (or `position: 'right'`) turns on the secondary
axis that `series[].yAxis` binds to — in combo charts an explicit binding now
beats the family-derived bar→left/line→right guess. `showLegend` is honored,
and `title`/`subtitle` render above the plot instead of only titling the
drill-down drawer.

**S3 — `series[].stack`, `annotations`, `interaction`.** Stacking passes the
author's group name through as Recharts' `stackId`. Annotations render as
`ReferenceLine` (`type: 'line'`) / `ReferenceArea` (`type: 'region'`) with the
declared axis, colour, style and label. `interaction.tooltips: false` suppresses
the hover card and `interaction.brush: true` adds the range selector;
`showDataLabels` prints values on the marks. `interaction.zoom` has no Recharts
primitive behind it and is deliberately still unimplemented rather than faked.
