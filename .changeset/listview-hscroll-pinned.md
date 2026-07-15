---
"@object-ui/components": patch
---

fix(components): keep the list-view horizontal scrollbar pinned to the viewport bottom

In a list/grid view with many columns, the horizontal scrollbar was only
reachable after scrolling all the way to the last row. Root cause: the shadcn
`<Table>` wraps its `<table>` in a `overflow-auto` scroll `<div>`. When
`DataTable` already renders the table inside a *bounded*
`flex-1 min-h-0 overflow-auto` region, that default wrapper became a SECOND,
height-unbounded scroll container — it stretched to the full table height, so
its horizontal scrollbar sat at the bottom of *all* rows.

- `Table` gains an optional `containerClassName` prop that overrides the
  scroll-wrapper `<div>`'s classes (default behavior unchanged).
- `DataTable` passes `containerClassName="overflow-visible"` so the outer
  bounded container owns both axes and the horizontal scrollbar stays pinned to
  the viewport bottom — reachable from any scroll position, no need to scroll to
  the last row.

Verified end-to-end against the running console (data-table with 60+ rows × 19
columns): the horizontal scroller is now the bounded `flex-1 min-h-0
overflow-auto` region (bottom on-screen, within the viewport) and the table can
be scrolled fully right while still at the top row.
