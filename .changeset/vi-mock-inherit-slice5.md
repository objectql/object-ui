---
---

Test-infrastructure only: sweep `@object-ui/plugin-form`'s frozen `vi.mock`
factories to the inheriting form across `plugin-view`, `app-shell` and
`plugin-designer` — 31 derived on the merge base plus one more that landed on
`main` mid-slice — and add the specifier to the `check-vi-mock-inherit` gate's
covered set. No published behaviour changes.
