---
---

Test-only change: the four `app-shell` `console/home` network-escape files in batch 4 of
objectui#7307 now serve their `/api/v1/meta/_drafts` probe from a recording double instead
of a real socket, and their lines leave `KNOWN_ESCAPES` and `PINNED_LEDGER` together. The
double answers an empty draft ledger, which is what `PendingDraftsBanner` already rendered
from the failed read, so no assertion moves. No published behaviour changes — no product
source is touched.
