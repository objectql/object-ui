---
---

Test-only change: a universal runtime census pin that fails when any registration
renders an authored `children` list while its registry meta omits `isContainer`,
plus `scripts/container-declaration-baseline.json` — a ratchet-to-zero list of the
44 existing violations (objectui#6779). No published behaviour changes; no
registration's metadata is altered by this change.
