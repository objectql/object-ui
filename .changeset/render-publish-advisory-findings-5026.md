---
'@object-ui/data-objectstack': patch
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Studio surfaces the runtime authoring gate's advisory findings after a **publish**, not only after a save

objectui#4133 / PR #4236 wired the gate's advisories to the save door and recorded, honestly, what that left unsurfaced: Studio's designer stages every edit as a `mode: 'draft'` save, drafts are never gated (the framework returns at its D1 early-return before a single rule runs), and the publish step that *is* gated returned no `advisories` field at all. So on the flow most tenants actually use, the author was told nothing at either door — for two different reasons, only one of which was objectui's.

The second reason has expired. `PublishMetaItemResponseSchema` now declares the same optional, omitted-when-empty `advisories` key that `SaveMetaItemResponseSchema` has carried since #4717, and `publishMetaItem` populates it. Measured against the installed `@objectstack/spec` (17.2.0) rather than inferred from the version number: the key survives a `safeParse`, a half-shaped finding is rejected, and a clean publish omits the key entirely. That reading is now a test rather than a note, so a spec drift fails CI instead of silently re-muting the door.

`MetadataClient.publish` and `MetadataClient.publishDraft` — the two methods over the single-item publish route `POST /meta/:type/:name/publish` — now report through the **same** sink, the same event and the same renderer the save door already used. No new UI shape: same warning tier, same 10s duration, same per-finding `rule` + `message` + `hint` formatting, findings still rendered verbatim as server prose. The wiring lands in the data layer rather than at the call sites, so `ResourceEditPage`'s Publish button and the runtime `RuntimeDraftBar` promotion (ObjectView / ReportView / DashboardView) are covered by one change, as are future ones.

One thing had to differ, and it is the frame's verb. Save and Publish are two different buttons in this product, so a toast that says "Saved" after a Publish tells the author their change is still a draft — the opposite of what happened. `MetadataSaveAdvisoryEvent` therefore gains a required `door: 'save' | 'publish'` and the renderer picks `console.publishAdvisoryTitle` (added to all ten locale packs) accordingly. `door` exists because `mode` cannot answer this: a direct active save and a draft promotion both report `mode: 'publish'`, since both land the body in the active overlay. It is required rather than optional so a future third door cannot be wired without saying which one it is.

Unchanged, deliberately: the **batch** door. "Publish whole app" (`POST /packages/:id/publish-drafts`) still discards per-draft advisories server-side — objectstack#9343, open and unruled — and nothing here compensates for that from the client side. A test pins the absence, so a later traversal of a batch-shaped `published[]` cannot be added without turning it red.
