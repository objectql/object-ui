---
"@object-ui/plugin-gantt": patch
---

ObjectGantt now supports the `api` data source for **both read and write-back**.
Previously `provider: 'api'` logged "API provider not yet implemented" and rendered
nothing, and every write-back (reschedule, dependency edit, delete, drawer
inline-edit) was hard-wired to the context ObjectQL `dataSource` + `objectName`,
so the api provider's `write` config was never used.

All reads and writes now flow through a single adapter resolved by
`resolveDataSource(schema.data, dataSource)`: `object` → context DataSource
(unchanged), `api` → `ApiDataSource` (executes the `read`/`write` HttpRequest
config), `value` → in-memory `ValueDataSource`. A pure-api view needs no
`objectName` and no context `dataSource` prop. Object-backed views are behavior-
preserving. Lookup/master_detail quick-filter option domains still resolve from
the context object backend (they degrade to distinct in-row values when absent).
