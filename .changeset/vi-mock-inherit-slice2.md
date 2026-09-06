---
---

Test-only change: the four frozen `vi.mock` factories on `@object-ui/plugin-charts`
and `@object-ui/plugin-dashboard` now inherit the real module's export surface, and
those two specifiers join `COVERED_SPECIFIERS` in `scripts/check-vi-mock-inherit.mjs`
(objectui#6892 slice 2). No published behaviour changes.
