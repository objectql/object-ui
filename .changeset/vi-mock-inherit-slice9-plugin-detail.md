---
---

Test-only change: the 13 `vi.mock('@object-ui/plugin-detail', ...)` factories that hand-listed the barrel's exports now inherit the real module and override after it, and `@object-ui/plugin-detail` joins the `check-vi-mock-inherit` gate's covered set. No published behaviour changes.
