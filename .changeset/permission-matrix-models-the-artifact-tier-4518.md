---
'@object-ui/app-shell': patch
---

The permission matrix models the server's artifact tier — no Save that 403s on a code-declared set

The server's metadata write gate is **two** tiers, and the permission-matrix editor modelled only the first. After the type tier was opened (#4446), an environment-scope edit of a **code-declared** permission set rendered live checkboxes and a Save button that failed at the end with `403 not_overridable` instead of a surface that explains itself up front.

The second tier is the one `saveMetaItem` applies after the type-tier disjunction has already passed: for an item a code package *ships*, `allowRuntimeCreate` is not enough, because overwriting a packaged item is an **overlay** and overlaying needs `allowOrgOverride`. `permission` sits exactly in that gap — `allowOrgOverride: false` (ADR-0005 forbids per-org overlay of a packaged set: silent privilege drift) with `allowRuntimeCreate: true`. The editor now computes the same three-way rule `ResourceEditPage` has modelled all along, read off the layered envelope it already fetches — including the `sys_metadata` provenance sentinel, so a **published org set** stays editable instead of being mis-read as a packaged one. No new server round trip.

It is scoped to the environment door. Under a `packageId` the write is a package-door draft (ADR-0086 P0/P2) and the measured behaviour is 200, so the #4446 headline case — a code-declared set on the single-kernel showcase — stays writable exactly as it was; a code-defined package there is already locked by the package-level read-only gate, which still dominates every other gate. Runtime-created sets stay editable at both scopes.

The new read-only case gets its own caption rather than borrowing an existing one. Naming the type would be the mirror image of the wording #4446 removed: the type *does* have a runtime write channel, and a brand-new set authored on this screen still saves fine — what is locked is this one set, because a code package provides it. The caption says that, and the hint carries the server's own reason and its documented remedy.
