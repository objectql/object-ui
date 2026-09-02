---
'@object-ui/plugin-grid': patch
---

Fix: a `dependsOn` lookup edited inline follows a parent edited in the same row **before**
it is saved (#7188, finishing #7165).

#7165 shipped an explicitly-labelled interim: the grid's inline editor scoped a
`dependsOn` picker by `ctx.row`, the **saved** record. Edit the parent cell, do not save,
open the child — and the child still listed candidates for the parent's persisted value
(or stayed gated if that value was empty). The grid now scopes by `ctx.pendingRow ?? ctx.row`,
where `pendingRow` is the row merged with its staged, unsaved edits, so picking a parent
re-scopes the child immediately — the form's live-record semantics from #2216. The interim
marker that named #7188 is gone with the interim.
