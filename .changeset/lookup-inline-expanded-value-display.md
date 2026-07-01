---
"@object-ui/fields": patch
---

fix(fields): inline lookup editor shows the selected record's name (not the "Select…" placeholder)

When editing a `lookup` / `master_detail` / `user` / `owner` field inline in the
data grid, the `LookupField` picker showed the placeholder instead of the
current record's name. The grid requests `$expand` for visible reference
columns, so a lookup cell's value arrives as the related record **object**
(`{ id, name }`) rather than a bare id. The read cell (`LookupCellRenderer`)
already resolves objects via the display-name path, but the inline editor only
matched **primitive** ids (`findOption(value)` with a strict `===`), so an
object value never resolved — and the hydration effect made it worse by calling
`findOne(referenceTo, <object>)` with a bogus id.

`LookupField` now resolves an expanded-reference object directly into its
display option (mirroring the read cell), skips the pointless per-object fetch,
and normalises object values to their id for option matching / multi-select
toggle / removal. `FieldEditWidget` also renders the relational pickers
`compact` inline — the same single-line, borderless trigger the line-item grid
uses — so the record name shows **in** the trigger instead of a chip stacked
above a "Select…" button.
