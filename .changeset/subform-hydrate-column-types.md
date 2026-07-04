---
'@object-ui/plugin-form': patch
---

Hydrate widget types on hand-authored master-detail subform columns. A view can
list a child grid's columns as bare `{ field, label }` (the common authoring
form); previously such untyped columns were passed straight to the grid, so a
`select` / `lookup` / `date` / `number` field silently rendered as a plain text
cell. `MasterDetailForm` (and `deriveDetail`) now resolve each untyped column's
`type` (plus `options` / `reference` / computed `expr`) from the child object's
schema via the new `hydrateColumns` helper — a picklist becomes a dropdown, a
lookup a record picker, a date a date input — while preserving the author's
exact column set, order and labels. Columns that already declare a `type` are
left untouched (the author's explicit choice still wins).
