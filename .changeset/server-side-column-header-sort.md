---
"@object-ui/types": minor
"@object-ui/components": minor
"@object-ui/plugin-grid": minor
"@object-ui/plugin-list": minor
---

feat(components,grid,list): a column-header sort orders the whole list, not the page you can see — #3106

Clicking a column header under server pagination sorted **the current page**.
The user saw "sorted by this column" and got "these fifty rows are in order;
page 2 starts over". The sort was real — its scope was not the one the screen
implied — and it had no way out of `data-table` at all: the sort lived in two
`useState`s with no callback, so the layer that issues the request could not
see it even in principle.

`DataTable` gains `manualSorting` + a controlled `sort` + `onSortChange`. In
that mode it sorts nothing, reports what a header click asks for, and renders
`sort` as the indicator — keeping **no** sort state of its own, because a
private copy beside a controlled prop is the shape the defect had.

`ObjectGrid` turns that into a `$orderby` in both of its server modes (its own
fetch, and a parent-driven one), and `ListView` lands it in `currentSort` — the
same state the toolbar's sort builder writes. One sort, two controls: that is
what makes "does a header sort outrank the saved view's sort?" a non-question
rather than a precedence rule someone has to remember.

Three details that are decisions, not incidentals:

- **A header click replaces the order** instead of appending to it, so the
  column under the cursor is the one the list is sorted by. Multi-key orders
  still come from the sort builder, and the headers render them numbered.
- **It cannot ask for "no sort".** In client mode the third click clears, and
  that is meaningful there — the rows return to the order they arrived in.
  Across a server-paged collection there is no such order (objectstack#4363), so
  a header offering it would hand the user a worse lie than the one being fixed.
  Clearing stays with the sort builder, which can restore the view's default.
- **Relational columns render no sort affordance** under server sorting. A
  `lookup` column shows a related record's name while `$orderby` can only order
  by the stored id (objectstack#4256) — the same reason #3096 removed them from
  the toolbar's sort picker. Client-side sorting keys off the rendered label, so
  those headers stay live there.

Client-side tables are untouched: same three-state cycle, same local sort.
