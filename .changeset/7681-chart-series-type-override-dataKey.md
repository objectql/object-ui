---
'@object-ui/plugin-charts': minor
---

Fix: a chart series' `type` override (`ChartDataSeries.type`, objectui#6121) is now
honoured when the series array is written in the internal `dataKey` binding, not only
the `name` binding (objectui#7681) — the same sentence #2945 shipped for the other
dialect.

`ChartRenderer`'s `isInternalShaped` fast path (introduced by #2945 to fix a different
bug — a `name`-shaped `series` shadowing the normalized `dataKey`-shaped one) took the
raw authored array untouched whenever every entry already carried `dataKey`, bypassing
`normalizeSeries` — the only place `type` is translated to the renderer-internal
`chartType`. So an author who wrote `series: [{ dataKey: 'revenue' }, { dataKey:
'margin', type: 'line' }]` — both keys independently valid on `ChartDataSeriesSchema` —
got neither the override nor a combo chart, silently.

`ChartRenderer` now always takes the series array through the one normalization layer
(objectui#2880 S1) instead of special-casing the `dataKey` shape around it.

**Breaking on unmodified documents, deliberately — this changes rendered output.** A
chart authored with a `dataKey`-shaped series carrying a `type` override used to render
one family for every series; it now renders the mix the author actually described (the
card's own regression case: two bars become one bar and one line).

**Two more effects on the delivered key set for a `dataKey`-shaped series array**,
undisclosed until now — `normalizeSeries` is a no-op on a well-formed entry, but these
two cases were never well-formed under the old fast path either:

- An i18n `label` written as a `{ en, zh-CN, … }` record on a `dataKey`-shaped entry was
  previously forwarded as that raw object; it is now resolved to a plain string (the
  first string-valued limb), matching what a `name`-shaped series already got from
  `normalizeChartSchema`.
- A `dataKey`-shaped entry whose `dataKey` does not resolve to a non-empty string (and
  has no `name` to fall back to) was previously forwarded as-is; it is now dropped from
  the delivered series array, matching what a `name`-shaped series with no usable key
  already got.

No existing well-formed internal caller (`DashboardRenderer`, `ObjectView`, the dataset
path) changes behaviour — every series entry those callers construct already carries a
non-empty string `dataKey` and a string `label`.
