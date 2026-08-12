---
'@object-ui/core': patch
'@object-ui/plugin-charts': patch
---

The multi-dimension pivot branch buckets a null first-dimension value instead of dropping its bar (objectui#4497)

`buildChartSeries`' pivot branch (2+ dimensions, single measure) bucketed rows by `String(xRaw ?? '')` but wrote the RAW value into the emitted row, so a null first-dimension value produced `{status: null, Low: 3}` and reached recharts with a null category — which draws no mark. Measured at the DOM: a two-group pivot drew ONE bar, and an all-null pivot drew axes and gridlines with zero bar rectangles and no empty state. That is the same mechanism objectui#4466 fixed one branch below, on the branch that card deliberately left pinned as-is until the pivot's own bucketing had been measured.

The pivot now maps a null/undefined first-dimension VALUE to the same bucket label the single-dimension branch uses — `ChartSeriesOptions.nullCategoryLabel`, defaulting to `NULL_CATEGORY_LABEL`. One doctrine, one predicate, two call sites; no new export, and every existing call site compiles and behaves identically.

The bucket KEY is untouched, which is what keeps this a display fix: `String(xRaw ?? '')` still decides which rows share a bar, so every existing grouping is byte-identical and only the label the bucket carries changes. Rows that lack the category key entirely are still not bucketed — that shape is a dimension grouped by but never projected (framework#4033), a different defect with a different answer.

Drill-through needed no change, which was measured rather than assumed: the pivot's emitted rows are AGGREGATED, so they are not index-aligned with `drillRawRows` and the one production caller (`DatasetWidget.handleChartDrill`) already drills by SEARCHING the raw rows through `findChartSeriesRow`. Those raw rows still carry their null, and objectui#4466's label-matching covers the multi-dimension arm as well as the single-dimension one, so the newly-visible bar resolves to the right record. Pinned at both levels so a regression in either half surfaces as the dead click it would be.
