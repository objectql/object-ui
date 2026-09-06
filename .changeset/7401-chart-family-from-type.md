---
"@object-ui/plugin-charts": patch
---

fix(plugin-charts): `pie-chart`, `donut-chart`, `radar-chart` and `scatter-chart` render as the family they name

A schema written as `type: 'pie-chart'` (or `plugin-charts:pie-chart`, and likewise donut / radar / scatter) drew a **bar chart**. The four registrations declared their family as `defaultProps: { chartType: … }`, and nothing on the SDUI path has ever read a registration's `defaultProps` — so `ChartRenderer` resolved no family and `AdvancedChartImpl` fell to its `'bar'` default. Valid data, a confidently wrong picture, and no `data-chart-error` that could fire.

`ChartRenderer` now derives the family from the schema's own `type`, through `normalizeChartSchema` — the package's single translation point, so the exported `normalizeChartSchema` answers what the runtime actually draws. An explicit `chartType` still wins, so `plugin-charts:chart` with `chartType: 'scatter'` is unchanged.

The five inert `defaultProps: { chartType: … }` are removed with it rather than left beside a mechanism that works. Registration `defaultProps` remains unread on the SDUI path repo-wide; activating it generally is a separate, wider change and is not this one.

⚠️ `scatter-chart` now genuinely reaches the scatter arm, so a two-series `scatter-chart` now renders the `scatter-multi-series` refusal it was always supposed to.
