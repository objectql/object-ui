---
'@object-ui/plugin-charts': patch
---

`ObjectChart`'s wrapper div now carries `h-full`, keeping the height chain intact from a dashboard grid cell's declared height down to the element Recharts measures. Previously the chain died at the plain auto-height wrapper: `height: 100%` on the chart container computed to `auto`, Recharts measured a permanent zero, and only the `CHART_MIN_HEIGHT` floor (#5503) kept dashboard charts visible — at a fixed floor height instead of filling the cell (#5451). Under auto-height parents `h-full` resolves to `auto`, so non-dashboard hosts are unchanged.
