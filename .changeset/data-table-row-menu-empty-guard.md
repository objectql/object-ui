---
'@object-ui/components': patch
---

fix(data-table): don't render a row overflow ("⋮") trigger that opens an empty menu

The row overflow trigger was gated on whether row-action **handlers** were
supplied (`onRowEdit` / `onRowDelete` / `rowActionDefs`), while the menu's items
were filtered a second time — per item, per record — against
`rowEditPredicates` / `rowDeletePredicates` and a custom action's `visible`. On a
row where every item was predicate-suppressed the trigger still rendered and
opened an empty box, which reads as a broken page.

The trigger is now decided by the items that will actually render for that row,
resolved through the same visibility rule the items gate themselves on, so the
two cannot disagree. The decision is per row: within one table a row that keeps
an action keeps its trigger while a row with nothing left renders none. The
actions cell itself is unchanged, so the column stays aligned with its header.
