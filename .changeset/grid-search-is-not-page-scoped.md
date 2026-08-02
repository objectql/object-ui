---
"@object-ui/types": patch
"@object-ui/components": patch
"@object-ui/plugin-grid": patch
---

A standalone grid's search box searches the list, not the page you can see (objectui#3118).

Under server-side pagination a standalone `ObjectGrid` rendered `data-table`'s
built-in search box, and that box filtered the rows the table was holding —
which is one page. The user read "2 results for X in this list" while 3075 rows
never participated, with the pager beside it still reading `1 / 63`. Every piece
was individually correct: `searchable` defaults to true, `manualPagination` is
true, and the two are declared next to each other in the same object literal.

This is objectui#3106 one axis over — sort there, filter here — and it takes the
same shape. `DataTable` gains `manualSearch` + a controlled `search` +
`onSearchChange`. In that mode it filters nothing, reports the typed term, and
renders `search` as the box's value, holding **no** term of its own: a private
copy beside a controlled prop is the shape the defect had. `ObjectGrid` turns
that term into a `$search` on the refetch — the server picks the matching fields
from the object's metadata (ADR-0061), the same channel the ListView toolbar has
always used — and returns to page 1, since a new term makes the old page index a
different set of rows (usually no rows at all). `$searchFields` rides along only
when the view declared `searchableFields`, which can narrow the server-resolved
set and never widen it.

Two things worth naming:

- Both paths are never live at once. The server's answer is the answer; a client
  pass left running underneath would silently re-narrow it to whichever returned
  rows happen to contain the term as *rendered text*, overruling the server's
  own notion of which fields are searchable.
- Under `manualSearch` a table with no `onSearchChange` renders **no** search
  box. The sort axis could degrade to inert headers; here there is no honest
  local behaviour to fall back to, because the rows to search are not in the
  browser.

Client-paginated grids are untouched: inline, bound and grouped grids hold every
row they display, so their box keeps filtering in memory, where the count it
produces is true. The ListView path was never affected — it passes
`showSearch: false` and searches from its own toolbar.
