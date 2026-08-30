---
'@object-ui/data-objectstack': minor
---

`aggregate()`'s spec-shape branch now REFUSES an unlowered `where` instead of
posting it (objectui#6825, maintainer ruling 2026-08-30 — option A).

**Breaking for callers that were already broken, so read this if you call
`aggregate()` with a `where`.** `aggregate()` has two branches. The analytics
branch takes `filter` and lowers a rule-shaped array before the wire (#6302).
The spec-shape branch — entered when `params` carries an array `groupBy`, an
array `aggregations`, or ANY `where` key — takes `where` and posts it to
`POST /data/:object/query` verbatim. It never lowered, and it still does not:
it now says so.

**What now throws that previously went through.** A `where` that is an ARRAY
the spec's own `isFilterAST` gate rejects — an unlowered
`[{ field, operator, value }, ...]` above all, plus the infix join dialect
(`[condA, 'or', condB]`), a tuple whose operator is outside the AST vocabulary,
`['and']` with nothing to join, and an element that is not a condition. The
throw is an `UnloweredAggregateWhereError` (exported), carrying the same
`code: 'INVALID_FILTER'` / `httpStatus: 400` pair as `MalformedFilterError`, so
`isMalformedFilterError()` recognises it and a failed widget renders "this
filter is malformed" rather than "check your connection".

**This adds no new failure — it relocates one.** Every shape now refused is one
the receiving engine already refused (`is not a filter`, 400 `INVALID_FILTER`,
before the store is touched). What changed is WHERE you find out and whether you
can act on it: previously the predicate was lost on the wire — or dropped
outright, leaving a chart rendering confident, wrong numbers with no signal to
its author. The refusal is now raised at the producer, names the value it
received, names the shape expected and where the spec declares it, and says
nothing was sent.

**What an affected caller should send instead.** Lower the rules to a filter AST
BEFORE calling `aggregate()`:

```diff
- adapter.aggregate('opportunity', {
-   groupBy: ['stage'], aggregations: [...],
-   where: [{ field: 'stage', operator: 'equals', value: 'won' }],
- })
+ adapter.aggregate('opportunity', {
+   groupBy: ['stage'], aggregations: [...],
+   where: ['stage', '=', 'won'],
+ })
```

Or keep using the analytics branch, which lowers for you: pass the rules under
`filter` with the legacy `field` / `function` / `groupBy` params.

**Unchanged, deliberately.** The analytics branch still lowers `filter` exactly
as #6302 left it. On the spec-shape branch a `FilterCondition` object
(`{ stage: 'won' }` — what `QuerySchema.where` actually declares), an empty
array (`[]` is "no filter", and the engine agrees), and every already-valid
filter AST all reach `client.data.query` byte-unchanged.
