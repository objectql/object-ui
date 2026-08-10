---
'@object-ui/plugin-grid': patch
---

fix(plugin-grid): don't render a row "⋮" trigger that opens an empty menu

The object list's row overflow trigger was gated on whether row-action
**handlers** were wired and how many actions were **declared**
(`(canEdit && onEdit) || (canDelete && onDelete) || menuDefs.length > 0 || rowActions.length > 0`),
while the menu's items were filtered a second time — per item, per record —
against `visibleWhen` / `visible`. On a row where every item was
predicate-suppressed the trigger still rendered and opened an empty box, which
reads as a broken page: a platform object whose row actions are gated for one
role showed a "⋮" on every row for everyone else, with nothing inside it.

The trigger is now decided by the items that will actually render for that row,
resolved through the same visibility functions the items gate themselves on, so
the two cannot disagree. The decision is per row: within one grid a row that
keeps an action keeps its trigger while a row with nothing left renders none. The
inline `variant: 'primary'` button reads that same shared rule. The actions
column is table-level and unchanged, so a row with nothing to offer renders an
empty cell and every row keeps the same cell count.

Which items render is untouched — only whether the trigger renders when none of
them survive.
