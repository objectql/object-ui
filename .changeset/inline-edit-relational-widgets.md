---
"@object-ui/fields": patch
---

fix(fields): inline-edit relational fields with the standard picker (not a text box)

Inline cell editing reuses the form's field widgets, but the inline map
(`EDIT_WIDGETS`) was a hand-maintained subset of the form's (`fieldWidgetMap`)
and had drifted: **lookup / master_detail / user / owner** had perfectly good
form pickers yet fell back to a plain text box inline (you'd type a raw record
id). Wire them up — `lookup`/`master_detail` → `LookupField`, `user`/`owner` →
`UserField`, the exact widgets the form uses. They read the related-object
dataSource from `SchemaRendererContext` (which the grid provides), so the
record picker opens, fetches, and selects inline.

To stop the two lists drifting again, `index` now exports `FORM_FIELD_TYPES`
and a drift-guard test pins the contract: every form widget type must have an
explicit inline decision — an editor in `EDIT_WIDGETS` or an entry in the new
`INLINE_EXCLUDED_FIELD_TYPES` (computed/binary/heavy/container types, each with
a reason). A future form widget can no longer silently become a text box (or a
missing editor) in the grid.
