---
---

Test-only change: the five network-escape files in batch 1 of objectui#7307 now serve their `/api/v1/security/explain` and `/api/v1/meta/object/<name>` probes from a recording double instead of a real socket, and their lines leave `KNOWN_ESCAPES` and `PINNED_LEDGER` together. No published behaviour changes — no product source is touched.
