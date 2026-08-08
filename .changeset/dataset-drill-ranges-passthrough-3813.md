---
'@object-ui/data-objectstack': patch
---

data-objectstack: pass the server's `drillRanges` date-bucket drill scope through `queryDataset` (restores date drill-through)

`queryDataset` rebuilds its result by **hand-picking** keys off the REST payload,
and `drillRanges` was never in the list — so the analytics service's date-range
drill sidecar (framework#1752) was dropped by the only real adapter in this repo,
while five consumer call sites were already reading it (`DatasetWidget.tsx:471`
and `:593`, `DatasetReportRenderer.tsx:316`, `:431`, `:855`).

The user-visible effect was not a degraded drill but a missing one. A
`dateGranularity` dimension groups a **span** of records into one bucket, which
equality filters cannot express, so `service-analytics` deliberately excludes
date dimensions from `dimensionFields`/`drillRawRows` and sends a parallel
half-open `[gte, lt)` range per row instead. For a chart or report grouped **only
by time** that makes `drillRanges` the *only* thing that can make
`canDrill = !!object && (drillDims.length > 0 || !!drillRanges?.length)` true —
with the key dropped, the entire drill entry point disappeared. A mixed
date + non-date grouping kept its drill but built a filter with no time bound, so
clicking June's bar opened every month (a superset).

Neither side's tests could see it: the dashboard and report tests mock their own
data source and feed `drillRanges` in directly, and the adapter's own suite never
asserted the key. The new adapter-level tests therefore mock the **envelope the
server actually sends** — bare (`res.json(result)`, no `{ success, data }`
wrapper), carrying `sql`, and for a date-only grouping carrying `object` +
`drillRanges` and *no* `dimensionFields`/`drillRawRows` — then assert the key
arrives verbatim and row-aligned, that the consumers' own `canDrill` predicate is
true, and that `buildDatasetDrillFilter` (the shared builder both surfaces call)
scopes the drilled list to the clicked bucket.

The declared entry type is `@object-ui/core`'s `DatasetDrillRange` **by
reference**, per the objectui#3613/#3752 discipline: it is the single in-repo
declaration of this shape (what the filter builder accepts and what both
renderers type their state with), and nothing in `@objectstack/spec` owns it yet,
so restating `{ field, gte, lt }` locally would create a third dialect of it.

`drillRawTotals` (the totals-row companion, framework#3214) is deliberately
**not** added: it has zero consumers in this repo, so passing it through would
add a declared-but-unexercised return key with no user-facing effect — it belongs
in the change that lands a totals-row drill and can test it.
