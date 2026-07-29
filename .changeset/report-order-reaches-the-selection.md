---
"@object-ui/plugin-report": minor
---

feat(report): carry a report's `order` into the dataset selection (framework#3916)

`@objectstack/spec` 17 gave reports an ordering declaration — `ReportSchema.order`
(and `blocks[].order` for a joined report): a list of `{ by, direction }` keys,
most significant first. The framework executor applies it. `DatasetReportRenderer`
built the selection it posts and never carried the declaration into it, so an
authored `order` reached no query and did nothing.

`useDatasetRows` — the single fetch choke point behind every report path — now
takes the lowered ordering, and all four call sites supply it: the grouped table,
the embedded chart, the matrix cross-tab, and each joined block.

- **Lowering.** `readOrder()` turns the authored list into
  `DatasetSelection.order`, the array's element order becoming the object's key
  insertion order (which is how sort significance is expressed on the wire). It
  is permissive about its input, like the neighbouring `readNames()` — stored
  report JSON crosses the repo boundary and may lag the schema, so an entry with
  no usable `by` is dropped rather than thrown. An absent or entirely-unusable
  list yields `undefined`, so the field is OMITTED and the server's own defaults
  still apply: a selected time dimension comes back chronological with nothing
  declared.

  Kept local rather than importing spec's `reportSelectionOrder` — the pinned
  `^17.0.0-rc.0` predates that export. Swap it for the import on the next bump.

- **Scoped per sub-selection.** A report's `order` is validated against its
  WHOLE selection, but this renderer issues narrower queries from it: the chart
  plots one dimension × one measure, and the flat-table path drops the matrix
  across-dimensions. The server rejects an order key naming nothing the
  selection projects (a deliberate 400), so forwarding the full list would turn
  a valid report into a failed chart. Keys outside a sub-selection are dropped
  at the choke point instead. Nothing is masked: the schema already validated
  every key against `rows` ∪ `columns` ∪ `values`, so the only keys that can be
  lost are ones the narrower query genuinely has no column for.

- **Part of the refetch key.** The ordering changes the ROWS the server returns,
  not just their presentation, so it joins the `useDatasetRows` signature — an
  ordering edited from asc to desc refetches instead of re-rendering the stale
  grid.

- **Matrix across-axis.** `colHeaders` are collected in row-arrival order, so
  ordering the rows by the across dimension is what makes the columns read
  left-to-right in that order. Ordering rides on the primary query only; the
  server drops it for the totals sub-queries by design.

Ordering stays server-side throughout — never a client-side re-sort, which would
order the page rather than the query and could not sort by a derived measure at
all.
