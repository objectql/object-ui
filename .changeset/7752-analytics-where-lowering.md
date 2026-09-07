---
'@object-ui/data-objectstack': minor
---

Array filters on analytics aggregates were posted un-lowered and refused by the runtime with 400; they are now lowered to the canonical `FilterCondition` before the wire.

An `element:number` or an `object-metric` whose filter is authored as an array (`[{ field, operator, value }, ...]`, a comparison tuple, or an `and`/`or` group) reached `POST /analytics/query` as an array. That route parses the body with `AnalyticsQueryRequestSchema` first, and its `where` is a `FilterCondition`, so the widget answered `400 Invalid AnalyticsQuery body: where: ...` instead of its number — leaving the MongoDB-style record as the only authoring form that still worked.

`aggregate()` now lowers the array through `parseFilterAST`, the single sink `@objectstack/spec` names for turning a `FilterArray` into a `FilterCondition`, so the posted `where` is the shape the wire declares. An empty array posts no `where` at all, a record-shaped filter is unchanged, and an array the sink cannot lower — an infix join such as `[condA, 'or', condB]` — is refused with this adapter's `INVALID_FILTER` / 400 error rather than posted or silently dropped into an unfiltered aggregate.
