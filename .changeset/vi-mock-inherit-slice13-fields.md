---
---

Test-only change: eight `vi.mock` factories in `@object-ui/app-shell` now inherit
the real `@object-ui/fields` export surface instead of freezing it, and the
`check-vi-mock-inherit` gate covers that specifier. No published behaviour changes.
