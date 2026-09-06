---
---

Test-only (objectui#7307 batch 5): three app-shell suites now serve their
`GET /api/v1/meta/object`, `GET /api/v1/automation/_status` and
`/api/v1/ai/conversations` probes from recording doubles instead of a real
socket, and their three rows leave the network-escape ledger. No published
runtime code changes, so nothing to release.
