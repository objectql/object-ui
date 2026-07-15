---
'@object-ui/fields': patch
---

fix(fields): LookupCellRenderer honors the target object's configured `display_field` (framework#2926 ⑧). ObjectGrid already forwarded `display_field` on the column meta, but the read cell ignored it and always ran the hardcoded heuristics (`name` first), so lookup columns showed the raw API name instead of the configured display/label field. The preferred field now threads through every render path (expanded objects, arrays, JSON strings, and the on-demand `useLookupName` fetch, whose cache key includes the display field to prevent cross-column stale names).
