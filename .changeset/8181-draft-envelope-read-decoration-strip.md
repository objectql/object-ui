---
'@object-ui/data-objectstack': patch
'@object-ui/app-shell': patch
---

fix(studio): one draft-envelope reader, and it strips the framework's read decorations

`client.getDraft()` serves a DECORATED body — the draft branch stamps
`_draft: true` and then `decorateMetadataItem` attaches `_diagnostics` for any
type with a registered Zod schema. The spec names both READ-TIME decorations
precisely because a served body "is NOT a valid input to the schema that
produced it until these are removed" (`METADATA_READ_DECORATIONS`).

objectui#7603 taught `ResourceEditPage` to strip them. It could only teach one
site, because `extractDraftBody` existed **four times** — three verbatim copies
plus a hand-rolled one in `ObjectHooksPanel` — and six more consumers unwrapped
the envelope inline. Ten readers, one of which knew the rule.

**The user-visible half.** The pending-changes sheet's per-entry diff compares
the published body against the draft body key by key. Those two reads are
decorated ASYMMETRICALLY — only the draft branch stamps `_draft` — so the sheet
listed `_draft` under "Also changed:" on every entry that has a published
counterpart, and `_diagnostics` alongside it whenever the two read-time verdicts
differed. Framework-internal keys were being presented to the author as their
own edits, on the screen where they decide whether to publish.

**The rest.** Six sites merged a decorated body into a document they then wrote
back through `save(..., { mode: 'draft' })` — the Studio app / page / object /
flow surfaces, the package OWD panel, the object hooks panel, and the
adapter's `updateView`. Today's server absorbs that (it strips read decorations
on ingress, before its own schema gate), so nothing 400s; this is still a client
emitting a body its own spec calls invalid, and the fix belongs at the producer.

The cure is one function rather than ten strips: `extractDraftBody` is now
exported from `@object-ui/data-objectstack`, beside the `getDraft` whose
envelope it decodes. The key list is the spec's exported
`stripReadDecorations` — never a second hand-maintained copy in this repo. The
presence verdict still runs BEFORE the strip, so removing our own annotations
can never turn a served draft into "nothing pending", and the ADR-0010
protection envelope (`_lock`, `_provenance`, `_packageId`, `_packageVersion`)
is deliberately untouched: those keys are declared by the closed schemas.

No schema was loosened, and no gate was taught to tolerate `_diagnostics`.
