---
---

Test-only change: the `@object-ui/components` `vi.mock` factories in `app-shell`,
`plugin-detail` and `plugin-timeline` now inherit the real module's export
surface instead of freezing a hand-written list, and the specifier joins the
`check-vi-mock-inherit` gate's covered set. No published behaviour changes.
