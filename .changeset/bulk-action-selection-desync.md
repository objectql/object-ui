---
"@object-ui/plugin-grid": patch
"@object-ui/components": patch
"@object-ui/types": patch
---

fix(plugin-grid): keep the grid's row selection in sync when a bulk-action dialog closes

Closing a bulk-action result dialog (e.g. 派工 / 下推) on **Done** cleared
ObjectGrid's `selectedRows` — which drives the selection toolbar — but never
touched the DataTable's internal checkbox state. Two visible problems:

- **Desync on success.** The toolbar disappeared while every row stayed visibly
  ticked, because the checkboxes are table-internal state the grid couldn't
  reach.

- **Lost selection on total failure.** When the run failed for *every* row
  (0 succeeded — a precondition error, say), the toolbar still vanished,
  stranding the user with no way to retry the exact rows they'd picked.

The dialog-close handler now gates the reset on `result.succeeded > 0`: a total
failure keeps both the selection *and* the toolbar (and skips the phantom
refetch) so the user can fix the cause and retry. When it does reset, a new
`selectionResetKey` prop on DataTable clears the internal checkbox selection in
lockstep with the toolbar, so the two never drift apart.
