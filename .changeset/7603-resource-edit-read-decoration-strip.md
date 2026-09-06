---
'@object-ui/app-shell': patch
---

Strip the framework's read-time decorations off a served draft before the metadata
editor's client Zod gate judges it (objectui#7603).

**The symptom.** Opening an item that has a **pending draft** in the metadata admin
raised a false "this item is invalid" banner plus inline field errors — on a body the
server accepts, and on exactly the workflow where an author is mid-edit. Every wired
metadata type whose schema is `.strict()` was affected (14 of the 15); `sharing_rule`
was shielded only by accident, because `AUTHOR_SHAPE_ONLY_TYPES` switches its edit gate
off for an unrelated reason.

**The cause.** `client.getDraft()` serves a **decorated** body: the strict draft branch
returns `item: decorateMetadataItem(type, …)`, which attaches `_diagnostics` whenever
the type has a registered Zod schema, and `_draft` on the preview-draft branch.
`ResourceEditPage` merged that body over the layered baseline and handed the result
straight to `validateMetadataDraft`. The layered half is clean — `getMetaItemLayered`
serves RAW layers — so the misfire required a pending draft to exist, which is why it
stayed invisible: an item with no draft passes today.

`@objectstack/spec` names both keys a read-time decoration and states that a served body
"is therefore NOT a valid input to the schema that produced it until these are removed".
The server was right and the client was wrong.

**The fix.** `extractDraftBody` — the one function that turns a served draft envelope
into a body, and the chokepoint all three merge sites go through (the load effect, the
post-save refresh, the post-publish refresh) — now passes the body through the spec's
own exported `stripReadDecorations`, the same helper `MetadataService.saveFields`
already uses on the write side. The strip runs after the presence verdict, so removing
our own decorations can never turn a served draft into "no draft".

No schema was loosened and no key list is restated in this repo. The list is the spec's,
reached through its helper, because a local copy goes stale the next time the framework
adds a decoration — and a decoration this code does not know to remove is precisely the
defect. The ADR-0010 protection envelope (`_lock`, `_provenance`, …) is deliberately
**not** on that list: those keys are allowlisted by the closed schemas so provenance
survives a re-parse, and this strip leaves them alone. A genuinely undeclared key on the
same draft is still refused, by name.
