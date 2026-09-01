---
'@object-ui/plugin-charts': minor
---

A sankey with no positive flow says so, instead of rendering an empty div
(objectui#7140).

`AdvancedChartImpl`'s sankey arm keeps only strictly positive measures, so a
chart handed **real rows** whose measure is all `0`, all `null`, all negative,
or unparseable built no links and returned a bare `<div>`. Measured in Chromium
against a populated control: the control drew 1 `<svg>` / 7 `<path>` /
26 descendants; each of those four tiles rendered `descendantCount: 1`,
`svgCount: 0`, `textContent: ''`, and their screenshots hashed identical to one
another. No marks, no text, no `role` — a tile indistinguishable from a widget
that had crashed, which is the one distinction the file's other refusals exist
to make.

It now renders through the `ChartRefusal` shell those refusals already use —
same box, same `role="status"`, and a new `data-chart-error="no-positive-flow"`
— reading *"This chart has no flow to draw: no row's `<measure>` is above
zero."*

Two boundaries are deliberate and pinned:

- **No rows at all is untouched.** That is the empty-result question, answered
  upstream in `ObjectChart` where the query outcome is known; a sentence about
  what the rows contain would be false about a dataset with no rows in it.
- **One positive row among zeros still draws.** The refusal fires on an empty
  link set, never on a thin one.

One code and one sentence for three causes (a genuinely all-zero flow, values a
flow cannot represent because they are negative, and measures `Number(…) || 0`
folds to zero): naming any single cause would be false for the other two, so
the copy names the predicate the filter actually applies, which is true for all
three. No recovery is promised. Every other chart family is byte-identical —
eight of the twelve tiles in the browser sweep hashed unchanged.
