---
'@object-ui/plugin-charts': patch
---

Scatter now says when it cannot place a row, instead of drawing an empty axis.

Scatter is the only two-measure positional chart in the renderer: `xAxisKey` feeds
a numeric X axis and `series[0]` a numeric Y axis, so a point exists only when
both are numbers. Measured in real Chromium, rows it could not place produced a
tile byte-identical to a scatter handed no rows at all, and six different
authoring failures shared one image. A chart with one placeable row among three
was 99.75% pixel-identical to a genuinely one-row scatter.

Handed rows it cannot place any of, a scatter now renders the file's refusal
shell under `data-chart-error="no-plottable-points"`, naming both keys. When some
rows place and some do not it draws as before with a `data-chart-note="unplotted-points"`
footnote carrying the count. Charts whose rows all place are byte-identical to
before, and no wrapper element is added to them.

The predicate is positional, not magnitude-based: zero and negative coordinates
are ordinary scatter data and keep drawing.
