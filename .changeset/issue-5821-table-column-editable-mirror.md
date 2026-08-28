---
'@object-ui/types': patch
---

Add `editable` to the rich `TableColumnSchema` zod mirror. The `TableColumn` interface declares `editable?: boolean` and `data-table` honours it, but the mirror omitted the key, so a non-strict parse silently stripped it — and since the renderer treats absence as `true`, a column an author locked with `editable: false` came out of validation editable again. Columns locked with `editable: false` now stay locked through any pipeline that parses metadata via `@object-ui/types/zod` (including the CLI `validate` route).
