---
'@object-ui/fields': patch
---

Render reference/lookup cells as labels, not raw JSON

A `lookup` / `master_detail` value can arrive as a JSON-encoded object string —
e.g. an unresolved external-id reference `{"externalId":"Website Relaunch"}`.
`LookupCellRenderer` treated the whole JSON string as an opaque id, failed to
resolve it, and fell through to `String(value)`, leaking raw JSON into the grid
cell (and detail/kanban surfaces).

- `LookupCellRenderer` now parses a JSON-object-looking string value and renders
  a human label (`name` → `label` → `externalId` → `id`).
- `coerceToSafeValue` (the shared safe-render helper used by 8 cell renderers)
  gains the same JSON-string parsing, and `externalId` is added to the
  reference-label precedence for plain object values and arrays.

Verified in the browser (showcase task grid: Project column shows "Website
Relaunch" instead of `{"externalId":"Website Relaunch"}`) and by unit tests.
