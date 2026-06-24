---
'@object-ui/app-shell': patch
---

New script action seeds a valid body; add create-roundtrip conformance guard

A new action defaults to `type: 'script'`, which the spec requires to carry an executable `body` or `target` — the create form seeded neither, so "New action → Save" failed validation (422). Seed a no-op L2 body in `createDefaults` so the default create round-trips. Adds a conformance guard that asserts every authorable type's default create-form output passes spec validation (catches the "designer minimal shape ≠ spec required" family before it ships).
