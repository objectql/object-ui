---
---

Test-only change: the 25 `vi.mock` factories that hand-listed `@object-ui/plugin-grid`'s
exports now inherit the real barrel's export surface, and the specifier joins the
`check-vi-mock-inherit` guard's covered set. No published behaviour changes.
