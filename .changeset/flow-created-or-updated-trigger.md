---
"@object-ui/app-shell": patch
---

feat(app-shell): Studio flow start node offers a "Record created or updated" trigger (#3427)

The record-change trigger now supports `record-after-write` (create OR update in
one flow), so the flow designer's start-node trigger picker offers a "Record
created or updated" option. Selecting it shows the Object and Entry-condition
fields, and the scope resolver puts both `record` and `previous` in scope for it
(`previous == null` is how an author branches the create leg) — mirroring the
runtime binding that fires the flow on both insert and update.
