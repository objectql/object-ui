---
---

Pin the two studio-design consumers that were already honest on an empty
metadata registry — `ObjectSettingsPanel` ("No default object inspector
registered.") and `ObjectHooksPanel` (a working generic `SchemaForm`) — and
add the populated-registry contrast for the Data pillar's four consumers, so a
future refactor cannot move either into the silent class, and an over-eager
empty-state branch cannot swallow the populated path (objectui#6846). Test
only; no package is released by this change.
