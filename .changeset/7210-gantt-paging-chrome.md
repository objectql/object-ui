---
'@object-ui/plugin-list': patch
---

A gantt list view no longer shows the record-count bar, because the bar describes a
request that view does not draw (objectui#7210, half 1).

`ListView` renders one record-count bar for every `viewType`: the row count, the
"Showing first N records. More data may be available." warning that goes with its own
`$top: pageSize` query, and a rows-per-page selector that re-issues that query. On grid,
kanban, calendar, gallery, timeline and map the bar is accurate — those renderers draw
the `data` `ListView` hands down.

On `gantt` it is not. Measured, not inferred: the registered `object-gantt` renderer
forwards no prop but `schema`, so the `data` prop never reaches the chart and
`ObjectGantt` issues its own query — one that carries no `$top` at all. In a harness of
18 rows with `pagination.pageSize: 6`, the chart drew all 18 while the bar under it read
"6 records · Showing first 6 records. More data may be available." Because it is the
only paging disclosure on the screen, a reader takes it as describing the chart; that
reading already produced a wrong finding in an application repo, which cost a browser
session to disprove. Authoring `pagination.pageSize` could not have fixed it either —
the chart's request never carried a page size to begin with.

Scoped to `gantt` alone. Every other surface keeps its bar unchanged, warning included;
a kanban over the same result set still reports its page honestly.

Not changed here, deliberately: the gantt's query still has no ceiling, and `ListView`
still issues its own paged query for that view (its rows still drive the loading
skeleton and load-error panel, `UserFilters`' option counts, and the client-side CSV /
JSON export). Capping a non-grid view's fetch is an open maintainer decision — adding
one would turn a complete schedule into a quietly truncated one — and this correction is
right whichever way that lands.
