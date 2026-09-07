---
---

Test-only change: the four `plugin-detail` network-escape files in batch 3 of objectui#7307 now serve their probes from a recording double instead of a real socket, and their lines leave `KNOWN_ESCAPES` and `PINNED_LEDGER` together. One of the four also reached `/api/task/42` through `DetailView`'s `api` branch, so its router serves that route too. No published behaviour changes — no product source is touched.
