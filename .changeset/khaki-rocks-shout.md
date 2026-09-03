---
"@object-ui/plugin-charts": patch
---

Draw every categorical x-axis label on short axes

A vertical bar chart in a dashboard-width widget dropped most of its x-axis
labels — three bars drew one label, five bars drew two — leaving the bars
unnamed, with no legend to fall back on because a single-series bar chart has
none.

The x axis applied one tick policy to time and category alike (`preserveStartEnd`
with a 48px `minTickGap`), which is right for hundreds of dates and wrong for a
band axis, where a dropped tick is an identity the reader cannot recover rather
than a sample they can interpolate. It was also keyed to the viewport rather
than the widget, so a 200px chart inside an 800px console was treated as a wide
one.

Bar, column, line, area and combo charts now draw every label on a categorical
x axis of five buckets or fewer — rotating, and ellipsising an over-long name
rather than clipping it. Longer axes keep the existing measured thinning, and
horizontal bars are unchanged.
