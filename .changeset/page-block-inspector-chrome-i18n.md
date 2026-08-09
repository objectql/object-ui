---
'@object-ui/app-shell': patch
---

fix(metadata-admin): page block inspector chrome follows the locale

`PageBlockInspector`'s own JSX carried hardcoded English that no translation
table could reach: the row-adder of every field list (`Add`), the per-row and
per-item remove `aria-label`s (`Remove` / `Remove item`), and the free-text
fallback placeholders of the object picker and the field list. All now resolve
through `engine.inspector.pageBlock.*` keys defined in both en-US and zh-CN.
The JSON editor's parse error reuses the catalog's existing
`engine.form.invalidJson` instead of its own literal, and holds the parse
failure as state so the message follows a later locale switch. English is
unchanged.
