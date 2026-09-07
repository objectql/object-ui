---
---

Test-only change: the ten `vi.mock('@object-ui/plugin-designer', ...)` factories in the
`AppContent.*` sibling family now inherit the real module's export surface instead of
freezing three of its 29 exports, and the specifier joins the covered set of
`scripts/check-vi-mock-inherit.mjs`. No published behaviour changes.
