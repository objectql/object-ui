---
'@object-ui/app-shell': patch
---

Declare `scim?: boolean` on `RuntimeFeatures` (objectui#5869), mirroring its
two commercial siblings `customDomain?` / `sso?` with the same
server-derived, absent-on-vanilla doc comment.

This documents the wire a shipped cloud producer already emits in the same
`resolveFeatures` object literal as `customDomain` / `sso`; the key already
arrives at the SPA today, untyped. Declaration only — this patch adds no
read point, no gate, and no SCIM UI affordance. Any actual SCIM-gated UI is
future work.
