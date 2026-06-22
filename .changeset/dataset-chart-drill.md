---
"@object-ui/core": patch
"@object-ui/plugin-charts": patch
"@object-ui/plugin-dashboard": patch
---

feat(dashboard): dataset chart widgets drill through to records

Dataset-bound **chart** widgets (bar/line/pie/area/donut/funnel/…) are now
click-drillable, matching table/pivot. Clicking a segment maps it back to its
dataset row and opens the same governed drill drawer (raw group keys preserved),
so a chart-only dashboard is no longer an exploration dead-end. This closes the
"object-backed chart drills but dataset chart doesn't" inconsistency and aligns
with mainstream BI (click a chart → see records).

- `@object-ui/core`: `findChartSeriesRow` — inverse of `buildChartSeries`,
  maps a clicked `{category, series}` back to the source dataset row index
  (matches both dims when a 2nd dimension is pivoted into series).
- `ObjectChart`: optional `onSegmentClick` lets a host own the chart click
  (and suppress the widget's own object-drill).
- `DatasetWidget`: lifts the drill machinery to cover both table/pivot and
  chart, and wires the chart's segment click to the precise dataset drill.
