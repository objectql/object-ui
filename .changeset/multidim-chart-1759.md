---
"@object-ui/core": patch
---

feat(chart): visualise the second dataset dimension as grouped series

A dataset chart with two dimensions (e.g. `['status','priority']`) previously
only rendered the first dimension — the second was invisible (repeated x-axis
labels, no grouping). New shared `buildChartSeries` helper (`@object-ui/core`)
pivots the second dimension into one series per value; `ObjectChart`
(plugin-charts) and `DatasetWidget` (plugin-dashboard) both use it, so
multi-dimension charts render consistently as grouped/coloured bars.

Refs objectstack-ai/objectui#1759, objectstack-ai/framework#1890
