---
'@object-ui/plugin-list': patch
---

fix(plugin-list): ListView hands the child grid the query behind the window it passes down

ListView owns the fetch on the external-pagination path — it holds the filter,
the search term and the sort, and it is the side that calls `dataSource.find`.
The grid it hands the window to has a cross-page "select all N matching"
escalation that RE-ISSUES that query to collect the whole match set, and with
nothing handed down it replayed its own never-written params ref and so asked the
server for the entire object, feeding unmatched records to bulk delete.

The params object is now hoisted out of the `find` call — one object, one query,
no reconstruction that could drift from what was actually asked — recorded past
the stale-request guard so it is always the query that produced the rows on
screen, and forwarded as `findParams` in the same handoff block as `rowCount`,
`page` and `onPageChange`. No public API of `ListView` changes.
