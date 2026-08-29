---
'@object-ui/data-objectstack': patch
---

`ObjectStackAdapter.aggregate()` lowers rule-shaped filter arrays before the
analytics wire, reusing the lowering `find()` already runs (objectui#6302).

`find()` has translated `[{ field, operator, value }, ...]` into the server's
filter AST for as long as `convertQueryParams` has existed. The analytics path
did not: `aggregate()` assigned `payload.where = params.filter` verbatim and
posted it to `/analytics/query`.

The two doors are not equally forgiving, so the gap had a user-visible end.
`lowerAnalyticsWhere` in `@objectstack/service-analytics` — shared by both
aggregation strategies — accepts AST tuples and throws on an array of rule
objects. A stored `ViewFilterRule[]` that a LIST renders correctly therefore
rendered `element:number` into its error state on every analytics-capable
deployment, which is the default one because the CLI always loads analytics.

An array filter now goes through the same `translateFilterArray` the `find()`
path uses — one lowering, so the two paths cannot disagree about one stored
filter. Rules spread into a logical node (`['and', ...rules, ...tuples]`, the
commonest composite there is) are lowered at depth, as they already were on
`find()`. Non-array filters are untouched: the MongoDB-style object this branch
was written for is what `/analytics/query` already accepts, and translating it
would be a semantic change this fix does not make. Already-AST arrays,
record-shaped filters, and the no-filter case are byte-unchanged.
