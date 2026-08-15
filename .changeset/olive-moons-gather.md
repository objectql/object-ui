---
'@object-ui/core': minor
---

Draw a null second-dimension group instead of carrying its measure invisibly

objectui#4673. `buildChartSeries`' pivot branch kept the pre-objectui#4466
answer on the SECOND dimension: it bucketed groups by `String(row[groupKey] ??
'')` behind a `gId !== ''` gate, so a group whose second dimension is `null`,
`undefined` or `''` never joined the series list — while the line below the
gate still wrote its measure into the emitted row under the `''` key. The
number was in the data and bound to no mark, which is #4466's harm verbatim one
dimension over: the chart understated its own data without saying so.

Measured on the card's repro — `GROUP BY status, priority` over a Backlog with
5 hours at High priority and 40 hours at no priority — the transform emitted
`{status: 'Backlog', High: 5, '': 40}` with a single `High` series, and the
renderer drew exactly ONE bar. The 40 hours were present in the row, scaled for
on the y-axis, and painted on nothing.

Two such groups were worse than unbound: `null` and `''` both key `''`, so the
later group silently overwrote the earlier one's measure and one of the two
numbers did not survive the transform at all.

**A known-empty group now draws; an unprojected key still refuses.** That split
is the doctrine the first dimension already used (objectui#4466 versus
`hasNoCategoryKey`, framework#4033), and it now answers the same way on both
dimensions. Concretely, a row that does not carry the group key at all gets no
bucket and contributes no column, where it previously wrote its measure under
`''`.

`null` and `''` are two different groups with two series, following
objectui#4508's ruling on the first dimension.

**The series key is collision-safe, not merely unlikely to collide.** Unlike an
axis bucket's private map key, a series key is a column of the emitted row and
the `dataKey` a renderer binds to, so it has to be unique within that row. A
group keys its column by its own display label — leaving an ordinary pivot's
rows, series, legend, tooltip and drill title exactly as they were — unless
that label cannot name it: shared with another group (a stored value spelling
the null bucket's label), reserved by the row itself (the x-axis column, the
identity carrier), or equal to some group's identity. Those key by identity
instead, which no other group has. Because no surviving label is any group's
identity, the two key spaces cannot meet.

Drill-through follows the same assignment: a clicked series key resolves back
to the group IDENTITY it names, and rows are matched on that. The previous
`String(r[gDim] ?? '')` comparison was the display-string matching
objectui#4508 removed on the x-axis — it spelled a null group and an
empty-string group alike, so the empty-string group's segment resolved to the
null group's records rather than its own.

No renderer change was needed: the null group's series carries the same
`nullCategoryLabel` the renderers already pass for the first dimension.
