---
---

Removed a dead pre-ADR-0079 `getRecordDisplayName` / `formatRecordTitle` copy from
`apps/console/src/utils.ts`. Both were unexported-from-behaviour dead code with zero
console importers (superseded by the unified `@object-ui/core#getRecordDisplayName`);
no published behaviour changes.
