---
"@object-ui/plugin-list": patch
---

Fix: a view declaring its `sort` in the `@objectstack/spec` bare-string
top-level form (`sort: "name desc"` — `ListViewSchema.sort` is
`string | Array<{field, order}>`) crashed ListView with
"schema.sort.map is not a function". Found by the spec/renderer
shape-mismatch audit that followed the dashboard filter-options crash.
Sort parsing is now a single normalized `parseSortConfig` (exported) that
accepts the bare string, legacy `"field desc"` array entries, and
`{ field, order }` objects, and returns `[]` for malformed entries instead
of throwing. The `@object-ui/types` declaration already carried the union —
only the implementation missed the string branch.
