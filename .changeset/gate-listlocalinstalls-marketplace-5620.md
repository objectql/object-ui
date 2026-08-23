---
'@object-ui/app-shell': patch
---

`MarketplacePackagePage`'s third fetch effect — `listLocalInstalls` — is now gated on
`marketplaceEnabled` and `isAdmin`, the same two predicates the page's other two fetch
effects already check, in addition to (not instead of) its existing
`features.installLocal` check (objectui#5620).

`listLocalInstalls`'s only consumer is `localInstalls.find(...)` in the content branch,
which is unreachable whenever the page has already returned `MarketplaceDisabled` (no
marketplace on this runtime) or `MarketplaceAccessDenied` (a refused viewer) — both
decided ahead of the content branch since objectui#5533 and objectui#5583. Before this
fix, a runtime with `features.installLocal: true` still fired the request — and
discarded its answer — on a marketplace-off runtime and for a non-admin, the same
wasted-round-trip class objectui#5533 established the fix for on this page, on the flag
that card was not about.

`features.installLocal` remains its own axis: a runtime can mount a local kernel install
path with no marketplace proxy at all, so the fix adds the two predicates as a
conjunction rather than replacing the existing check. The request still fires exactly
when it did before AND the viewer would actually see its answer.
