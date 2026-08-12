---
'@object-ui/core': minor
'@object-ui/plugin-charts': patch
'@object-ui/i18n': patch
---

A null-keyed group renders as an explicit bucket instead of silently vanishing from a chart (objectui#4466)

`buildChartSeries`' single-dimension branch passed rows through verbatim, so a row whose category VALUE is `null` reached recharts with a null category and drew no mark. The visible outcome was not an empty chart but a quietly wrong one: rows `[{user_id: null, event_count: 51}, {user_id: 'Dev Admin', event_count: 2}]` drew exactly ONE bar — the dominant group, 51 of 53 events, dropped while the y-axis scale still accommodated it, so the chart understated its own data and the axis proved the data had been there. With every group null it drew axes, gridlines and an axis title with zero marks and no empty state, which is the shipped first-boot state of the built-in System Overview board's "Events by User" (every seeded `sys_audit_log` row is written with `user_id = NULL`).

The mapping lives in the shared series layer, so dashboard widgets and standalone `ObjectChart` get one answer rather than a per-chart patch in the recharts wrapper. It resolves the two-answers disagreement the card names as well: an empty result set keeps the designed empty state, a non-empty result always draws bars — the null bucket included.

`@object-ui/core` gains `NULL_CATEGORY_LABEL` and `ChartSeriesOptions`; `buildChartSeries` and `findChartSeriesRow` each take an optional trailing `options`. Both additive — every existing call site compiles and behaves identically, and a result with no null category is still returned by array identity. The two helpers are a pair on purpose: the caller matches a clicked segment against rows that still carry the raw `null`, so `findChartSeriesRow` reads the bucket label back to that row and the newly-visible bar keeps its drill-through instead of resolving to `-1`.

The label goes through the i18n channel (`chart.nullCategory`, en `(None)` / zh `(未指定)`, all ten packs), passed down by the renderer: `@object-ui/core` is React-free and cannot read the locale bundle, so it takes the resolved string the same way `dimensionOptionTranslator` takes a resolver. Its English constant is the floor for a provider-less host, not the mechanism.

`hasNoCategoryKey` (framework#4033) is untouched and now documented against this: a row that does not carry the category key AT ALL is a different defect — a dimension grouped by but never projected — and keeps its explanatory placeholder. The bucket deliberately never ADDS the key to such a row, which is what keeps that guard's signal alive. Key absent → the placeholder; key present with a null value → the bucket.
