---
"@object-ui/plugin-grid": patch
"@object-ui/i18n": patch
---

fix(plugin-grid): make the import wizard's preview step readable — wider columns + friendlier validation errors

Two problems on the import wizard's 预览 (preview) step:

- **Cramped preview table.** With many mapped columns crammed into the fixed
  dialog width, each header collapsed to one character per line (`关联排班计划`
  stacked vertically) and became unreadable. Columns now get a `min-width` and
  headers no longer wrap, so the preview area scrolls horizontally instead of
  crushing every column.

- **Unreadable dry-run error messages.** A reference cell that couldn't resolve
  rendered as `第 1 行: product: product: no os_tianshun_ehr_product matches "导管架"`
  — the field named twice, an internal object api-name leaking through, all in
  English. The server already tags each failure with a structured `code`, so we
  now drive the message off that code (localized, with the offending value),
  resolve the field's api-name to its label, and only fall back to the raw
  server text — minus the duplicated prefix — for unrecognized codes. The same
  row now reads `第 1 行: 产品：找不到匹配 "导管架" 的记录`.
