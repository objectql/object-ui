---
---

Add `scripts/measure-strict-authoring-face.mjs`, the measurement throwaway for
objectui#7581 (first deliverable of the #5250 ruling). It derives strict twins
of every node schema in memory and counts undeclared keys per component across
the catalog fixtures, the `content/docs` JSON fences and the authored documents
under `apps/**` and `packages/*/examples/**`. Tooling only; no schema, gate or
`.passthrough()` changes, and no package is released by this change.
