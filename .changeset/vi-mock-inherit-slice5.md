---
---

Test-infrastructure only: sweep `@object-ui/plugin-form`'s 31 frozen `vi.mock`
factories to the inheriting form across `plugin-view`, `app-shell` and
`plugin-designer`, and add the specifier to the `check-vi-mock-inherit` gate's
covered set. No published behaviour changes.
