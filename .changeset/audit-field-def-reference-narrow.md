---
---

Narrow `AuditFieldDef`'s relationship-target read in `app-shell`'s record History
diff helpers to the spec spelling `reference`, carried as a bare `string`.

No release: nothing published changes. `AuditFieldDef` and `auditHistoryDisplay`
are package-internal — neither is re-exported from `src/index.ts`, and the
package's `exports` map exposes only `.` and `./styles.css`, so no consumer can
reach either. Runtime behaviour is unchanged on every document that can reach the
helper: `normalizeSchemaReferenceKeys` stamps both snake_case spellings at the
metadata ingestion choke point, and the removed `string[]` carrier was already
refused at runtime by the `typeof` narrowing that stayed.
