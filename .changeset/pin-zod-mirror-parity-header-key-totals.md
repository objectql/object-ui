---
---

Test-only change to `@object-ui/types`' zod-mirror-parity pin file. Its header stated
`KnownDrift` as **62 keys**; two independent instruments measure **63**, wrong since
objectui#7664 and green the whole time (objectui#8222). The digit is corrected and the
remaining LIVE figures in that header are closed out: the two unpinned key totals and
the three cross-ledger restatements are now derived from the ledgers through the
header's own spelling, and the one figure that cannot be derived is excluded in
writing with its reason. No published behaviour changes.
