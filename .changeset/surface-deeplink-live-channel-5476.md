---
'@object-ui/app-shell': patch
---

Studio's pre-publish security block can now take you to the object it names.

The pending-changes sheet reports what the publish door would refuse — as
`object/crmext_visit`, with the rule's fix-it hint and "Fix it on the object under
Settings → Record sharing". Naming it was the half that shipped; reaching it was not.
The `?surface=<type>:<name>` deep-link that would have carried the author there
captures the URL exactly ONCE, at mount, and the sheet is opened over an
already-mounted pillar — so writing the param changed the URL and moved nothing.

That mount-time capture is deliberate and stays exactly as it was: the mirror half
rewrites the param on every in-pillar selection, so a capture that followed the URL
would re-trigger its restore on each one. What was missing is a third half — a live
target delivered BESIDE the URL, which is what a producer already inside the pillar
needs. `surfaceDeepLinkChannel` adds it: producers ask for a surface by identity
(`{type, name}`), the host routes cross-pillar requests back through the URL (that
pillar is unmounted, so its capture is the right mechanism) and vetoes the ones the
author declines over unsaved edits, and the mounted pillar applies the rest.

Applied AT MOST ONCE, by a monotonic id. A standing request re-resolved on the next
rail reload would drag the author back off whatever they had since selected — the
regression the mount-time ref exists to prevent — so `DataPillar.surfaceRequest.test`
pins a hand-picked object surviving a package switch, and
`surfaceDeepLinkChannel.test` pins the capture itself as an unchanged control: it
still ignores every URL change after mount, and a live request never moves it.

The sheet's other home is the Home / draft-preview bar, where the Studio object editor
is not a reachable destination at all. Reachability is answered structurally — the
producer hook returns `null` when no host published the channel — so off-Studio the
item name stays the prose #5418 shipped rather than becoming a link to nowhere. Both
directions are assertions in `DraftChangesPanel.securityLink.test`, not a comment.

Nothing the other three pillars observe changed: `useSurfaceDeepLink` keeps its
signature, its return and its behaviour, and only the Data pillar subscribes to the
new channel. The channel is its own React-only module on purpose — importing the hook
into the sheet would have pulled `nav-selection` and the App-nav inspector into the
console's eager graph.
