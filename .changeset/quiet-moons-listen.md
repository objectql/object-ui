---
'@object-ui/core': minor
'@object-ui/plugin-charts': patch
'@object-ui/plugin-dashboard': patch
---

A clicked cartesian mark names its own series, and the drill title reads its label

objectui#4672, objectui#4682.

**The dead pivoted drill.** objectui#4680 fixed what a cartesian click could
read out of recharts 3's `MouseHandlerDataParam`, and measured the wall it could
not get past: a chart-level click is an AXIS interaction, and recharts
dispatches those with `activeDataKey` hard-coded `undefined`, because the shared
cursor spans every series at that tick. A pivoted dataset chart — 2 dimensions,
1 measure, the shape ADR-0021 introduced — needs the series to resolve its drill
row, so every segment of every such dashboard chart stayed a dead click. The
series was left unresolved rather than guessed, and the card carried the rest.

The answer is the mark itself. This renderer draws the `Bar` / `Line` / `Area`,
so an item-level `onClick` closes over the very `dataKey` it was rendered with —
the series is statically known, not inferred from tooltip state.

Both handlers fire for one gesture (measured: item first, chart second, sharing
one `nativeEvent` object), so the item handler does not emit. It RECORDS its
series, stamped with that gesture, and the chart-level handler composes the one
event. That is the double-fire answer and the additive property together:

- **one click, one drill event**, because there is one emit site — not a second
  event suppressed after the fact;
- **a click that lands on no mark is untouched**: it records nothing and falls
  through to the objectui#4680 axis answer exactly as shipped — category, bucket
  identity, and the series only where one series is plotted. Empty plot area
  stays category-only, and "drill the whole category" was rejected as a
  different product question. Nothing that resolved before stops resolving; a
  line's `dot={false}` stroke simply GAINS the exact series where it is hit;
- pairing on the shared DOM event rather than on a flag means a record left by
  one gesture can never be adopted by a later click.

The clicked key is forwarded exactly as rendered, `''` included: the
empty-string second-dimension group draws its own bar since objectui#4673, and
`''` is falsy, so a truthiness test on the way out would send no series at all
and leave that bar's drill standing on the reader's coercion instead of on what
was clicked.

**The opaque drill title.** `ChartSegmentClickEvent` gains `seriesLabel`, and
`DatasetWidget`'s drill drawer titles itself from `seriesLabel ?? series`.
`ev.series` stays the LOOKUP key — `findChartSeriesRow` resolves it through the
same assignment `buildChartSeries` made — and only the title reads the label.

The two strings are equal for every ordinary group, which is why reading the key
as a title went unnoticed. They part company when a group's label cannot name
it: the null bucket beside a record whose stored value literally spells
`(None)`, which is objectui#4508's collision on the series axis, reachable since
objectui#4673. Both groups then key by `chartBucketId`, and the drawer opened on
the right records under the title `Backlog / [null]`. An internal id where a
label belongs reads as broken DATA rather than as a broken title.

Neither string can do the other's job, which is why this is a second field
rather than a change to the first: the label is not resolvable (it is exactly
what the colliding groups share) and the key is not showable. `seriesLabel` is
optional and absent wherever a renderer resolved no label, so every other
chart's title is byte-identical.
