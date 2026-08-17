---
'@object-ui/core': minor
'@object-ui/plugin-charts': minor
'@object-ui/plugin-dashboard': minor
---

Give a chart bucket an identity distinct from its display label

objectui#4508. `buildChartSeries` used the bucket's DISPLAY string as the
bucket's own key, so two pairs of genuinely different groups were conflated —
and the segment click that drills a bar back to its records inherited both
conflations. The maintainer ruling (2026-08-14) approved the sentinel-identity
direction, aligning the chart branch with the distinct-bucket-id form the pivot
TABLE (`buildPivot`) already uses over the same dataset rows.

Two collisions, one cause:

- **A null group and an empty-string group drew ONE bar.** The pivot branch
  keyed buckets by `String(xRaw ?? '')`, which spells `null` and `''`
  identically. The bar took its label from whichever row created the bucket, and
  the other group's segment then resolved to no row at all — a visible bar whose
  click did nothing.
- **A record whose stored value spells the bucket label stole the null bucket's
  drill.** A row storing the literal text `(None)` (or any localized
  `chart.nullCategory` — `(未指定)` and the other nine packs) kept its own
  bucket, so two bars carried the same axis text and BOTH resolved to the first.
  That one is a wrong drill, not a dead one: clicking the null bucket's bar
  opened the drawer on another group's records.

What changed:

- **`chartBucketId`** (`@object-ui/core`) is the bucket identity — the SAME
  encoder `buildPivot` keys its buckets with (`pivotBucketId` over
  `pivotDimensionValue`), so the two surfaces stop answering one question two
  ways. The pivot branch now buckets by it, which is what makes null and `''`
  two groups again.
- **`CHART_BUCKET_ID_KEY`** carries that identity on an emitted row, written
  exactly where two DISTINCT buckets paint the same axis text — the complete set
  of cases where the display string cannot name what was clicked. An ordinary
  chart's rows are returned untouched (by identity), so no renderer-internal key
  reaches an authoring surface.
- **`findChartSeriesRow`** takes that identity back as `options.bucketId` and
  treats it as authoritative. The renderers forward it: the drill event gains
  `categoryId` (`ChartSegmentClickEvent`, now declared once in
  `@object-ui/core` instead of inline in three packages), `AdvancedChartImpl`
  reads it off the clicked row on the cartesian, pie and funnel paths, and
  `DatasetWidget.handleChartDrill` hands it to the lookup.

Behaviour change worth noting: an empty-string category no longer resolves to a
null-valued row. That tolerance was justified as the drill layer's own spelling
of "no group value", but no producer of this lookup's `category` writes it,
while `''` IS the axis text a genuine empty-string group paints — so the
tolerance was giving that group's bar a different group's records. A host that
forwards no `categoryId` keeps its existing drill unchanged.
