---
'@object-ui/plugin-grid': patch
---

ObjectGrid's bulk-bar **Clear** now unticks the row checkboxes, instead of only removing the toolbar

Selecting rows and pressing Clear emptied the bulk-actions bar but left every row checkbox at `data-state="checked"` (the header checkbox stuck at `indeterminate` on a partial pick). The user was stranded on a page of ticked rows with no toolbar left to act on them, and the only way out was a reload or re-selecting and clearing through some other path.

The selection lives in two places: `selectedRows`, which is the grid's own state and drives the toolbar, and the row checkboxes, which live inside the embedded data-table and only clear when `selectionResetKey` moves. `resetSelection()` writes all three, and the delete / dispatch / dialog-close paths have gone through it since the reset-key mechanism was introduced. Both `BulkActionBar` mount sites, however, hand-wrote their `onClearSelection` as `setSelectedRows([]); setSelectAllMatching(false);` — exactly `resetSelection()` minus the key bump — so Clear updated one source and left the other ticked. Both sites now call `resetSelection()`, so there is one reset for every path that clears a selection rather than three hand-copied ones, and the cross-page "all matching" state drops with it.
