---
---

Test-only: `packages/types`' zod-mirror-parity guard now compares the UNION of the
mirror's keys and the declaration's, and ledgers the newly visible half separately
(objectui#6058; the stale prose counts objectui#6141 measured are corrected in the same
file). No published type, mirror or runtime behaviour changes — nothing in `src/` outside
`__tests__/` is touched, so there is nothing to release.
