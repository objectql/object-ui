---
"@object-ui/types": minor
---

feat(types)!: drop the `ObjectStack/ObjectOS/ObjectQL/ObjectUI Capabilities` re-exports (framework capabilities-descriptor prune)

Upstream `@objectstack/spec` removed the dead static capability-descriptor
cluster (`ObjectStackCapabilitiesSchema` / `ObjectOSCapabilitiesSchema` /
`ObjectQLCapabilitiesSchema` / `ObjectUICapabilitiesSchema` + their types) —
a never-wired fixed-boolean self-portrait whose defaults contradicted the
live platform (FLS/RLS/audit all `default(false)` while actually enforced).
This drops the `@object-ui/types` re-exports of those symbols.

**Migration**: discover real runtime capabilities at runtime, not from a
static schema — `GET /api/v1/discovery` (dynamic `capabilities` record with
declared === enforced discipline) and the `/.well-known` contract
(`WellKnownCapabilitiesSchema` from `@objectstack/spec/api`). No replacement
re-export.
