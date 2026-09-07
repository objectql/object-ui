---
---

Test-only change: the nine `vi.mock('@object-ui/plugin-list', ...)` factories in the
`ObjectView` / `InterfaceListPage` / `ObjectDataPage` family under
`packages/app-shell/src/views` now inherit the real module's export surface instead of
freezing one of its twelve exports, and the specifier joins `COVERED_SPECIFIERS` in
`scripts/check-vi-mock-inherit.mjs`. No published behaviour changes — no product source
and no `package.json` was touched.
