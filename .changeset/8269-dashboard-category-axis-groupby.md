---
'@object-ui/core': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-charts': patch
---

Fix a dashboard chart widget that declares its category as `aggregate.groupBy` being
refused for lacking a `name` column (objectui#8269).

A widget bound to an object with `aggregate: { function: 'count', groupBy: 'status' }`
and no `options.xField` rendered a refusal instead of a chart:

> This chart cannot plot its category axis: no row has a `name` field.

The author wrote `groupBy: 'status'`. Nothing on screen said `groupBy` was the key that
had been ignored, and `name` appeared nowhere in their metadata — so the diagnostic sent
them to debug the wrong layer.

**Cause.** The two dashboard relays (`DashboardGridLayout`, `DashboardRenderer`) each
floored the category binding on a literal — `options.xField || 'name'` — and handed it to
the `object-chart` node without ever consulting the aggregate that decides it. An
object-bound aggregate returns one row per group keyed by the raw `groupBy` field, so no
row carried `name` and the category-axis guard (framework#4033) fired correctly on a
binding that was already wrong when it arrived.

**Fix.** `chartCategoryKey` is a new `@object-ui/core` export delegating to
`chartAggregateCategoryKey` in `@objectstack/spec/ui` — the contract's own derivation of
"the category column an object-bound aggregate produces", and the published sibling of the
`chartAggregateValueKey` that objectui#8266 adopted for the measure axis. Both relays now
consult it for the object-provider branch.

**What moves on screen.** A widget that rendered a refusal now draws. Measured through
`ChartRenderer` at 480x320 over the rows a fieldless count returns
(`[{status:'open',count:2},{status:'paid',count:5}]`): the composed binding went from
`xAxisKey: 'name'` — a `missing-category-key` refusal, 0 marks — to `xAxisKey: 'status'`,
1 series and 2 marks with the category ticks drawn.

**Unaffected.** A chart with no `aggregate` at all keeps the author's `xField` (its rows
are raw records, so that key is the right one), an UNGROUPED aggregate keeps it too (it
returns a single row with no category column), and the authored-literal-rows branch — the
`chart` node composed after the object-provider check fails — keeps its floor unchanged.
One authored key changes meaning, exactly as objectui#8266's `yField` did: an `xField`
written on an object-bound chart that ALSO declares a `groupBy` no longer wins over the
aggregate's own column — it named a record column a grouped aggregate never returns, so it
produced the same refusal before.
