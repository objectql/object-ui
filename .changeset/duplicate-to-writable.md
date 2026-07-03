---
"@object-ui/app-shell": patch
---

feat(studio): 复制 (duplicate base) on writable packages in the builder landing

Writable base cards on the builder landing gain **复制** — a name/id inline form
that calls `POST /packages/:id/duplicate` (ADR-0070 D4: re-namespaced clone with
rewritten references) and drops the user straight into the copy's builder — the
Airtable "duplicate base" gesture. Read-only code packages stay browse-only:
duplication copies `sys_metadata` rows, which code packages don't have; their
customization path is template/marketplace install.
