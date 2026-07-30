---
"@object-ui/plugin-charts": minor
---

fix(charts): a spec `series[].type` override actually draws, and a spec-shape `series` plots at all (#2945)

#2945 listed `combo` (`plugin-charts`) as renderer-local dialect to "promote or
delete". Neither: the spec **already models a combo chart**, per-series, and its
own field comment says so —

```ts
// spec/src/ui/chart.zod.ts — ChartSeriesSchema
/** Series type override (combo charts) */
type: ChartTypeSchema.optional().describe('Override chart type for this series'),
```

— exactly as it models stacking with `ChartSeries.stack` rather than a
`stacked-bar` family. So `combo` is not a name an author should reach for; it is
what "the series disagree about their family" looks like from the renderer's
side. `effectiveChartFamily` now derives it, and `combo` stays a documented
renderer-local marker (internal callers pass it directly today).

Chasing that turned up two live bugs, both silent, on the path a spec author
takes.

**1. The per-series override was parsed, carried, and then dropped.** Only the
renderer's `chartType === 'combo'` branch read `series[].chartType`, so

```ts
{ type: 'bar', series: [{ name: 'revenue' }, { name: 'margin', type: 'line' }] }
```

drew `margin` as a bar. Nothing was wrong at any layer but the last — a unit test
even asserted the value was carried.

**2. A spec-shape `series` rendered nothing at all.** `series` is the one binding
both shapes spell with the same key, so `ChartRenderer`'s blanket "internal props
win" rule let the author's `[{ name }]` shadow the normalized `[{ dataKey }]` and
reach a renderer that reads `dataKey`. Blank chart. Every other spec binding has a
distinct name (`xAxis` vs `xAxisKey`), which is why only this one broke — and why
the isolated normalization tests all passed over a dead path. The raw array is now
preferred only when it already speaks the internal shape, so internal callers are
byte-for-byte unchanged and a mixed array works too.

**Also fixed in passing:** the combo branch had an `area` arm under a `BarChart`
container, and Recharts renders an `<Area>` child of `BarChart` as nothing — so an
authored combo with an `area` series drew a blank series. The container is now
`ComposedChart`, which is what Recharts provides for mixed marks.

Widening only. A chart whose series all resolve to one family keeps its own
family, an explicit `combo` is untouched, and a family with no per-series meaning
(`pie`, `horizontal-bar`, …) is never widened. A derived combo binds series to the
left axis unless one asks for `yAxis: 'right'` — the spec's own default — so
widening changes the series' mark and not its scale; the legacy bar→left/line→right
guess is kept for an authored `combo`, where it was historically the only way to
reach a second axis.

Guards: `effectiveChartFamily` / `comboBaseFamily` are unit-tested over the whole
family matrix; DOM-level tests assert the **marks** rather than the derived family,
since the carry was already covered and the drawing was what broke; and
`spec-derived-unions.test.ts` asserts `combo` is absent from the spec's
`ChartTypeSchema`, so the day it is adopted upstream the derivation is named as the
thing to retire.
