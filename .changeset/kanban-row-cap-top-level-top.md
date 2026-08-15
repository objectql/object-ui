---
'@object-ui/plugin-kanban': patch
'@object-ui/fields': patch
---

`object-kanban` now caps its fetch with a real top-level `$top`, and honours `limit`.

The board's row cap was written `dataSource.find(objectName, { options: { $top: 100 }, $filter: … })`
— `$filter` at the top level, where the adapters read it, and the cap one level
down under `options`, which is not a `QueryParams` key. Nothing in this repo
reads `params.options` (`convertQueryParams` in `@object-ui/data-objectstack` and
`ApiDataSource` both read `params.$top`), so the intended cap never reached the
wire: a board over a large object fetched every row the server would return and
grouped all of it into lanes client-side. The author's 100 was never live.

The cap is now `$top: schema.limit ?? 100`, the shape `object-timeline` took for
the identical defect. Two consequences worth reading before upgrading:

- **A board that used to fetch unbounded now fetches 100 rows by default.** That
  is the previously-declared intent taking effect, not a new limit — but a board
  over an object with more than 100 matching records will show fewer cards than
  it did. Authors who want the old behaviour should declare the window they
  actually want (`limit: 500`), not rely on the absence of one.
- **`limit` is now mapped from the `dataSource` binding** (`object-kanban`'s
  `ElementDataSourceMapping` gains `limit: 'limit'`). A board bound to a saved
  view is capped by that view's `pagination.pageSize`, and the binding's own
  `limit` overrides it. The flag comes with the read site: it stayed unmapped
  until now on the rationale that the board had a "fixed window", which is the
  claim this change falsifies. `sort` remains unmapped — the board still has no
  `$orderby` read site — and `columns` remains unmapped because a board's columns
  are its swimlanes, not a field projection.

`KanbanSchema` gains `limit?: number` (the board's row cap; distinct from a
column's `limit`, which is that lane's WIP limit and never reaches the query),
and the guide's per-block table in `content/docs/guide/data-source.md` no longer
claims a fixed window for `object-kanban`.

`@object-ui/fields` carried the same nesting in the lookup-name fallback
(`find(referenceTo, { $filter: { id }, options: { $top: 1 } })`) where it was
harmless — a primary-key equality returns at most one row with or without a cap.
It is spelled `$top: 1` now, so no live instance of the dead nesting is left in
the repo to read as precedent. No behaviour change there.
