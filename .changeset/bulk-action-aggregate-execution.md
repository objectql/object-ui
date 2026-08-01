---
"@object-ui/types": minor
"@object-ui/plugin-grid": minor
"@object-ui/core": minor
"@object-ui/app-shell": minor
---

Aggregate single-call mode for bulk actions: `execution: 'aggregate'` (objectui#3139).

A `bulkActionDefs` entry with `operation: 'custom'` used to have exactly one
dispatch shape: one action-runner call per selected record (`_rowRecord`
attached). "Select N rows → ONE call that receives every selected id" — the
zip-of-QR-codes / merged-PDF / batch-print shape — could not be expressed, so
downstream projects fell back to per-row `window.open` storms or gave up.

`BulkActionDef` now carries `execution?: 'perRecord' | 'aggregate'` (default
`'perRecord'`, existing views untouched). An aggregate def dispatches its
action exactly once for the whole selection with `params._selectedIds:
string[]` injected and the full records published as
`context.selectedRecords`. The authored form usually just names a declared
object action — `{ name, operation: 'custom', execution: 'aggregate' }` —
and `resolveBulkActions` attaches the declaration. Results are
all-or-nothing: a failure is attributed to every id with the real error and
per-row Retry is hidden (re-running the action is the retry; a total failure
keeps the selection). `batchSize` does not apply; `maxRecords` still gates.

The executor rides the existing `executeBulkBatch` bulk-first decision tree —
the aggregate call is its `bulkCall`, and the per-row "fallback" only
re-throws the captured error for attribution, never fans out N dispatches
against an endpoint written for one `_selectedIds` call.

Also: url/api target interpolation now exposes `${ctx.selection.ids}` (comma
-joined) and `${ctx.selection.count}` from the grid's checkbox selection, so
a plain `list_toolbar` action can carry the selection without bulk plumbing;
the console's server-action handler recognizes `_selectedIds` and skips the
single-record multi-select guard for aggregate dispatches.
