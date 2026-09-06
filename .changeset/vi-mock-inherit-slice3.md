---
---

Test-only change: the 102 frozen `vi.mock` factories on `@object-ui/auth` now inherit
the real module's export surface, and that specifier joins `COVERED_SPECIFIERS` in
`scripts/check-vi-mock-inherit.mjs` (objectui#6892 slice 3). The barrel was measured
inert at module scope before converting, so nothing new runs at import time. No
published behaviour changes.
