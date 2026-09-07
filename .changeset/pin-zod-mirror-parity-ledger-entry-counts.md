---
---

Test-only change to `@object-ui/types`' zod-mirror-parity pin file: the three LEDGER
entry counts its header states, and the ratchet section's restatement of the first of
them, are now compared to the ledgers they describe (objectui#7733). One of those
figures was already wrong on `main`. No published behaviour changes.
