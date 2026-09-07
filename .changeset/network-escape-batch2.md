---
---

Test-only change: the four network-escape files in batch 2 of objectui#7307 (three in `plugin-kanban`, one in `plugin-gantt`) now serve their `/api/v1/security/explain` probe from a recording double instead of a real socket, and their lines leave `KNOWN_ESCAPES` and `PINNED_LEDGER` together. No published behaviour changes — no product source is touched.
