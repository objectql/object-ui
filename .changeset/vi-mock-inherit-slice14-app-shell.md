---
---

Test-only change: 23 `vi.mock` / `vi.doMock` factories in `@object-ui/console` now
inherit the real `@object-ui/app-shell` export surface instead of freezing it, and
the `check-vi-mock-inherit` gate covers that specifier. No published behaviour
changes.
