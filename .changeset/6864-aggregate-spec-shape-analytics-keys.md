---
'@object-ui/data-objectstack': minor
---

`aggregate()`'s spec-shape branch now REFUSES the analytics branch's `filter` /
`field` / `function` instead of dropping them (objectui#6864, extending the
maintainer ruling of 2026-08-30 on objectui#6825 — option A, refuse at the
producer).

**Breaking for callers that were already broken, so read this if you call
`aggregate()` with an ARRAY `groupBy`.** The spec-shape branch — entered when
`params` carries an array `groupBy`, an array `aggregations`, or any `where`
key — builds its request from exactly four keys: `groupBy`, `aggregations`,
`where`, `limit`. `filter`, `field` and `function` are the OTHER branch's
parameters, and they were neither read, nor refused, nor warned about: they
were simply absent from the body that went to `POST /data/:object/query`.

**Why that was worse than the `where` half #6825 fixed.** `field` + `function`
are the analytics branch's whole measure, and this branch takes a measure only
out of `aggregations`. So the legacy shape `{ field, function, groupBy, filter }`
whose `groupBy` happened to be an ARRAY produced a query carrying a `groupBy`
and **no aggregations at all** — a grouping with no measure — with the author's
filter gone as well. The chart rendered, the numbers were wrong, and there was
nothing on screen or on the wire to look at.

**What now throws that previously went through.** A spec-shape call carrying a
non-nullish `filter`, `field` or `function` throws the new
`AnalyticsKeysOnSpecShapeError`. It carries the `INVALID_FILTER` / 400 pair its
siblings carry (so `isMalformedFilterError()` recognises it and a failed widget
renders "this filter is malformed" rather than "check your connection"), plus
`keys` — the offending key names — and `received`, what each one carried. The
message names each key, says what its spec-shape equivalent is, states which
`looksLikeSpecShape` disjunct put the call on this branch, and says outright
when the resulting query would have had no measure. Nothing is sent to the
server, so no unfiltered numbers come back.

**What is deliberately NOT refused.** The legacy analytics shape (a STRING
`groupBy`) is untouched and still lowers `filter` and still fuses
`field` + `function` into its measure — the refusal lives inside the spec-shape
branch only. A key that is present but nullish (`filter: undefined`) carries
nothing to drop and passes, so params built by spreading possibly-absent
authored values keep working. And keys outside those three (`orderBy`, a future
spec key, any host extra) are not refused: the gate names three keys, and only
those.

**Migration.** Pick one shape per call. Spec-shape: `{ groupBy: GroupByNode[],
aggregations: AggregationNode[], where?, limit? }`, with `where` already lowered.
Analytics: `{ field, function, groupBy: string, filter? }`, which lowers `filter`
for you. `AnalyticsKeysOnSpecShapeError` is exported from
`@object-ui/data-objectstack`.
