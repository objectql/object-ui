---
'@object-ui/app-shell': patch
---

The marketplace package detail page decides "you are not an admin" before it fetches,
instead of after the load has already failed.

`MarketplacePackagePage` ordered its early returns with the `!isAdmin` guard *after*
both the loading branch and the `error || !data` branch, and gated its two fetch
effects on `features.marketplace` alone. On a runtime that mounts a marketplace, a
non-admin who opened a package URL was therefore walked through the fetch and the
skeleton, and — when the load failed — was handed the destructive "Failed to load
package" card carrying the server's own error message. Whether that viewer was
refused or handed a diagnosis about a surface they are not allowed to use came down
to whether an unrelated request happened to succeed.

The guard now sits ahead of both branches, and `getMarketplacePackage` and
`getCloudInstallationInfo` are gated on `isAdmin` as well, so the page stops issuing
requests on behalf of a viewer it has already decided to turn away. That is the
discipline objectui#5533 established on this same page for `features.marketplace`,
applied to the other predicate that decides the same thing. It is also the ordering
`MarketplacePage` carries after objectui#5557, so the two sibling pages now answer one
runtime the same way for every viewer. The server remains the authority on what a
non-admin may fetch; this only stops the client doing work it would discard.

Unchanged for an admin, deliberately and under test: a failing load still produces the
destructive card with the server's message intact, and a successful one still renders
the package. A "fix" that hoisted the refusal unconditionally, or that deleted the
failure branch, would satisfy every non-admin assertion and fail those two.

`loading` stays seeded from `marketplaceEnabled` alone rather than from
`marketplaceEnabled && isAdmin`. `isAdmin` reads `activeMember`, which `AuthProvider`
resolves asynchronously *after* the session settles, so an admin whose role comes from
the org member row renders once as a non-admin before the flag flips. Seeding `false`
there would leave that first admin render with `loading: false` and no data — the
destructive card, painted for a frame before the effect could raise the flag again.
`MarketplacePackagePage.guardOrder.test.tsx` pins the flip case for that reason, along
with the ordering, the skipped requests, and the marketplace-off boundary the guard
must not jump above.
