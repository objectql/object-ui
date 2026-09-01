---
'@object-ui/plugin-charts': patch
---

`ObjectChart` now renders a self-describing empty state when its query succeeds
and returns no rows, instead of falling through to a bare chart frame.

The frame was measured in a browser rather than assumed: recharts derives its
ticks from the data, so with an empty result the bar and line families emit two
hairline axis rules and no `text` nodes at all, and pie/donut emit nothing —
there are no labelled axes to tell the reader what would have been plotted.
Beside the component's own red "Failed to load chart data" box, a blank tile
gives the reader nothing to distinguish a young chart from a broken one.

The copy is the one `plugin-dashboard` already shows on the dataset-bound path
("No data yet" / the load succeeded / the source name), so the same chart over
the same empty result no longer reads two different ways depending on which
widget drew it. Charts with inline authored data are unchanged — they ran no
query to report on.
