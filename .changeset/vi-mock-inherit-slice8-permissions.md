---
---

Test-only change: 24 `vi.mock('@object-ui/permissions', ...)` factories now inherit
the real module's export surface instead of freezing a hand-listed one, and the
specifier joins `COVERED_SPECIFIERS` in `scripts/check-vi-mock-inherit.mjs`. No
published behaviour changes.
