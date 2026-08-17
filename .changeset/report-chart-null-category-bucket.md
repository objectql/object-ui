---
'@object-ui/plugin-report': patch
---

fix(plugin-report): route a report's embedded chart through `buildChartSeries` so a NULL category is bucketed (objectui#4878)

`DatasetReportChart` built its rows as `relabelDimensions(state.rows, …)` and
handed them to the registered chart component verbatim. Nothing on that path
bucketed a null dimension value, so a report chart passed the renderer a null
category — the exact input objectui#4466 measured as drawing **no mark at all**.
The cost is not an empty chart but a quietly wrong one: the null group vanishes
while the y-axis scale still accommodates it, so the chart reads as valid data.

The dashboard and chart-view surfaces never had the defect because they route
through `buildChartSeries` (`@object-ui/core`), where the whole null-category
family was fixed. The report chart now routes through it too, so those
properties are INHERITED rather than re-derived on a third surface:

- the null bucket itself (objectui#4466);
- its label read from the locale bundle at the call site — `@object-ui/core` is
  React-free, so a zh console would otherwise draw the bar and label it `(None)`
  (objectui#4500);
- bucket IDENTITY separate from the bucket label, so a stored value that
  literally spells `(None)` stays a different group (objectui#4508).

objectui#4020's three-level measure display name still outranks the label the
derivation assigns, including for an `{ en, 'zh-CN' }` label record: core holds
no i18n provider and picks first-string-wins, which is exactly the defect class
#4020 closed.

A report whose chart has no null group is unchanged, byte for byte.
