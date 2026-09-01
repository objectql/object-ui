---
'@object-ui/plugin-charts': patch
---

Pie, donut, funnel and treemap now say when rows carry no magnitude they can draw.

These four families size a mark BY its measure, so a row whose value is zero,
negative, `null` or unparseable stays in the data and is given no area. Measured
in Chromium across 74 tiles: an all-zero pie put ZERO non-white pixels on the
page while its DOM carried 31 descendants and a real `svg`; a treemap handed
`40 / null`, `40 / 0` or `40 / -25 / -12` rendered one full-bleed leaf that was
byte-identical to a genuinely one-row treemap; and a funnel handed `40` beside a
`null` drew no segments at all and labelled the tile with the row that had no
value.

When no row can be sized, these charts now render the file's refusal shell
(`no-positive-magnitude`) instead of a blank tile. When only some rows can be
sized, the chart still draws and carries a note counting the ones it could not.
All-positive charts, charts handed no rows at all, bar charts, and both sankey
answers are unchanged.
