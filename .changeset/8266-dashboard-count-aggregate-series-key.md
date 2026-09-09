---
'@object-ui/core': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-charts': patch
---

Fix a dashboard chart widget with a FIELDLESS `count` aggregate plotting nothing
(objectui#8266).

A widget bound to an object with `aggregate: { function: 'count', groupBy: 'status' }`
and no `field` — the normal way to author "how many records per status" — rendered an
empty chart. No error, no empty state: a plot frame with the category ticks drawn and
not one mark in it, which reads exactly like "this object has no rows yet".

**Cause.** The two dashboard relays (`DashboardGridLayout`, `DashboardRenderer`) each
built the series binding as `aggregate?.field || (options.yField || 'value')`, which for
a fieldless count resolves to `'value'`. The rows an object-bound fieldless count
returns are keyed `'count'` — the alias the engine projects `COUNT(*)` under, pinned
since framework#3701. A `dataKey` naming a column no row carries plots nothing, and
neither of the renderer's two guards fires on it: the rows DO carry the category key,
and the series array is not empty.

**Fix.** `chartMeasureKey` is a new `@object-ui/core` export delegating to
`chartAggregateValueKey` in `@objectstack/spec/ui` — the contract's own derivation of
"the value column an object-bound aggregate produces". Both relays now consult it, and
the row-projection side (`aggregateValueKey` in `@object-ui/plugin-charts`) is routed
through the same function, so the two halves of the question cannot drift again.

**What moves on screen.** A chart that was blank now draws. Charts that already drew are
unaffected: a field-bearing aggregate resolves to its raw field under both the old and
the new reading, and a chart with no `aggregate` at all keeps the author's `yField`.
One authored key changes meaning: a `yField` written on an object-bound chart that
ALSO declares an aggregate no longer wins over the aggregate's own column — it named a
record column that a grouped aggregate never returns, so it plotted nothing before.

**Not fixed here, and out of scope.** The same widget with no `options.xField` is
refused by the category-axis guard naming `name`, a key the author never wrote (they
wrote `aggregate.groupBy`). That is the category half of the same relay gap and is
filed separately.
