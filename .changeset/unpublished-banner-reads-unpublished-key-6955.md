---
'@object-ui/app-shell': patch
---

The Unpublished-app banner now reads the ADR-0045 publish gate `_unpublished`, not the navigation flag `hidden` — so a published app that is merely kept out of the launcher no longer wears the "only builders can see it" watermark

Upstream (framework PR #6942, objectstack#4829 ruling A1) split one flag into two with disjoint meanings: `_unpublished` is the machine-managed publish gate that materialization sets and publish clears, while `hidden` became author-declared navigation presentation and nothing else — "Hidden apps stay fully routable and permission-checked". `UnpublishedAppBar` read `hidden`, which after that split was wrong in **both** directions at once, and both are fixed here:

- **False positive.** A published, nav-hidden app — the built-in `account` app is the specimen — rendered the amber "Unpublished app — fully functional, but only builders can see it" bar. The app was live to every user; the console told its owner the opposite.
- **False negative.** A genuinely unpublished app whose author had not also set `hidden` rendered no bar at all. The server withholds unpublished apps from non-builders, so this watermark is the *builder's own* only signal that what they are looking at is not live yet — losing it means publishing feels already-done.

This was not latent: console pin bump objectstack#7308 put an objectui build keying on `hidden` in front of a framework that had already redefined it, so both directions were live in the bundled console.

The Publish button on that bar writes `PUT /meta/app/{name}` with `{"_unpublished": false}` instead of `{"hidden": false}`. `false` rather than a key delete, matching the server's own `POST /packages/:id/publish-drafts` flip: ADR-0045 §3 makes publish/unpublish symmetric, so the gate stays two-state rather than a key whose absence has to be re-derived. Whatever `hidden` the app carries now rides through the write **untouched** — publishing an app must not silently rewrite the author's navigation choice, which is the regression objectstack#4829 was filed for in the first place. The package-level Publish (`POST /packages/:id/publish-drafts`) is unchanged; the server-side flip it triggers already clears `_unpublished`.

**Launcher surfaces deliberately do NOT move to the new key** and are pinned against it by test, because the symmetry is a trap rather than an oversight. `_unpublished` is enforced server-side — the REST metadata gate withholds those apps from everyone who should not see them — so an unpublished app that reaches the client at all belongs to a builder who is entitled to navigate to it; filtering it in the launcher would hide a builder's in-progress app from the builder while buying no protection the server was not already providing. `hidden`, by contrast, has no other enforcement point anywhere: that client-side filter *is* its entire implementation. Two keys, two enforcement layers, so the App Switcher, the `AppContent` launcher list, the home grid and the root landing resolver all keep filtering on `hidden` alone.

No authoring surface, wire format or exported type changes. The `publish-drafts` response fields `unhiddenApps` / `unhideError` keep their spelling: the framework still emits exactly those names, and renaming only the consumer would be the same silent break this pair of cards exists to close.
