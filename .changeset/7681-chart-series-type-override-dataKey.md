---
'@object-ui/plugin-charts': patch
---

Fix: a chart series' `type` override (`ChartDataSeries.type`, objectui#6121) is now
honoured when the series array is written in the internal `dataKey` binding, not only
the `name` binding (objectui#7681).

`ChartRenderer`'s `isInternalShaped` fast path (introduced by #2945 to fix a different
bug — a `name`-shaped `series` shadowing the normalized `dataKey`-shaped one) took the
raw authored array untouched whenever every entry already carried `dataKey`, bypassing
`normalizeSeries` — the only place `type` is translated to the renderer-internal
`chartType`. So an author who wrote `series: [{ dataKey: 'revenue' }, { dataKey:
'margin', type: 'line' }]` — both keys independently valid on `ChartDataSeriesSchema` —
got neither the override nor a combo chart, silently.

`ChartRenderer` now always takes the series array through the one normalization layer
(objectui#2880 S1) instead of special-casing the `dataKey` shape around it.
`normalizeSeries` is a no-op on a well-formed internal-shaped entry (it round-trips
every key the internal series shape declares), so no existing internal caller
(`DashboardRenderer`, `ObjectView`, the dataset path) changes behaviour.
