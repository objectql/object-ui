---
"@object-ui/plugin-grid": patch
---

fix(grid): a bulk delete / by-name action clears the row checkboxes, not just the toolbar — objectui#3056

After a successful bulk delete (or a bulk action dispatched to a
consumer-registered runner handler), the selection toolbar vanished but every
row stayed visibly ticked. The user was left on a page of selected rows with no
toolbar to act on them, and no way back except unticking each row or reloading.

`ObjectGrid` carries two selection sources that must move together:
`selectedRows` (ours — drives the toolbar) and the data-table's internal
`selectedRowIds` (drives the checkboxes, cleared only when the host bumps
`selectionResetKey`). `handleBulkDialogClose` reset both; `dispatchBulkAction`
reset only the first, on both of its branches.

Both now go through one `resetSelection()` helper — including the dialog path,
so the invariant is structural rather than three call sites remembering to
agree. Failure semantics are untouched: a by-name action that reports
`success: false` still keeps the toolbar AND the checkboxes so the user can fix
the cause and retry the same rows.
