---
'@object-ui/app-shell': patch
---

Declare `scim?: boolean` on `RuntimeFeatures` and map it through
`initRuntimeConfig` (objectui#5869), mirroring its two commercial siblings
`customDomain?` / `sso?` end to end: same doc-comment style
(server-derived, absent-on-vanilla), same `false` default, same
`body.features.scim === true` derivation.

This documents and now honestly carries the wire a shipped cloud producer
already emits in the same `resolveFeatures` object literal as
`customDomain` / `sso`; the key already arrives at the SPA today, untyped.
Declaration plus plumbing only — this patch adds no read point, no gate,
and no SCIM UI affordance. Any actual SCIM-gated UI is future work.
