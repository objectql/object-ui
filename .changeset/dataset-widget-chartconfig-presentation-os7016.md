---
"@object-ui/plugin-dashboard": patch
---

Dashboard metadata's `chartConfig` presentation keys now take effect for the first time

`DashboardWidgetSchema.chartConfig` is declared as the full spec
`ChartConfigSchema`, but the ADR-0021 dataset path lowered exactly one key onto
the chart renderer: `showLegend` (objectui#3135). Everything else an author wrote
there — the chart's own `title`/`subtitle`, the accessibility `description`, an
explicit plot `height`, a `colors` palette or per-category colour map,
`showDataLabels`, `annotations`, `interaction` — parsed as valid metadata,
reached `DatasetWidget`, and was dropped before the chart schema was built. The
underlying chart block draws all of them; only the dashboard's hand-off was
missing.

`DatasetWidget` now lowers each of those keys, on two mechanical criteria, both
of which have to hold:

1. **The chart block draws it end to end on this path.** `{ type: 'chart' }`
   resolves to `ChartRenderer` → `AdvancedChartImpl`, which draws
   `title`/`subtitle` above the plot, turns `description` into the chart
   container's `role="img"` + `aria-label`, applies `height` as that container's
   inline height, paints `colors`, prints `showDataLabels` as per-point labels,
   draws `annotations` as reference lines/bands and honours `interaction` as the
   tooltip toggle plus the range selector. Each is pinned at the DOM level, so a
   key is never forwarded to a prop that ignores it.
2. **It does not fight the dataset derivation.** `xAxis`, `yAxis` and `series`
   are derived from the widget's dataset selection, so an authored one would
   shadow the derived binding and blank the chart; they stay unforwarded, as does
   `type` (the widget's own `type` already picks the chart family). `aria` stays
   unforwarded too, for the other reason: nothing on this path reads it.

`colors` is split the way the react tier already splits it, because the two arms
reach the renderer through different props: a `string[]` is the positional
palette, a `{ value: color }` record is a per-category map merged over the
category dimension's own option colours.

**Behaviour-opening surface.** A dashboard that already wrote any of these keys
goes from having them ignored to having them applied — the point of the change,
but visible: a widget that declared `chartConfig.title` now shows that title
inside the plot area (in addition to the widget card's own `title`, which is a
separate key), one that declared `height` no longer fills its card, one that
declared `colors` stops using the theme palette, and `showDataLabels`,
`annotations` and `interaction.brush` start drawing. Widgets with no
`chartConfig`, or with only `showLegend`, render exactly as before: undeclared
keys are never emitted, so the renderer's own defaults stay in charge.

Part of objectstack#5175 (the enforce half); the narrowing half — what to do
about `aria`, and about `xAxis`/`yAxis`/`series` being declared on a surface that
derives them — is still open there.
