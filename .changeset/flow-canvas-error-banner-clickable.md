---
"@object-ui/app-shell": patch
---

feat(studio): make the flow-canvas error banner clickable

The inline structural-error banner (ADR-0044 cycle surfacing) is now driven by
the unified `problems` list, and each row with a concrete target is clickable —
clicking it selects and pans-to-reveal the offending node/edge (the same reveal
the Problems panel performs). So the always-visible banner is actionable without
opening the panel. Drops the now-redundant `validationErrors` string prop: the
banner, the Problems panel, and the on-canvas badges all share one source.
