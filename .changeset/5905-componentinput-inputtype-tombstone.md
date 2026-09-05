---
'@object-ui/types': minor
'@object-ui/plugin-markdown': minor
---

Retire `ComponentInput.inputType` — the fifth and last key objectui#5905 named (ADR-0049
enforce-or-remove, maintainer ruling 2026-08-31, option B).

`inputType` was held back when `min` / `max` / `step` / `placeholder` were retired, because
its defect was a different one. Those four were declared-and-UNREAD. `inputType` was
declared-and-DROPPED: the repository really did author it — `packages/plugin-markdown`
wrote `inputType: 'textarea'` on its `content` input, pinned by that package's own test —
while the manifest serializer dropped it. Retiring it therefore had to decide what that
registration should say instead, which is the fork the card reported and the ruling closed.

FROM → TO:

- `inputType?: string` → **tombstoned** (`?: never` on the interface, `retirementTombstone()`
  named refusal on the Zod mirror). Put the control hint in `description`, which IS
  published.
- `plugin-markdown`'s `inputType: 'textarea'` write → **deleted**, at zero capability cost.

The write was measured as a no-op before it was deleted, and re-measured on this branch's
base rather than inherited from the card. A structural census over every `inputs:` array in
the repository (211 regions, all tracked TS/TSX/JS sources) scores `inputType` at exactly
ONE authoring site — the `plugin-markdown` registration — against `name` 953, `type` 969,
`label` 966, `description` 194, `enum` 119, `required` 86 and `binding` 4 in the same pass
over the same regions, so the instrument was not blind. The other 192 in-repo `inputType`
hits are a DIFFERENT face: `FormField.inputType` (`zod/form.zod.ts`), the text-input
renderer's prop, and `SchemaBuilder.inputType`, none of which sit on a `ComponentInput`.
The publication path is unchanged and was re-confirmed: `packages/sdui-parser/src/index.ts`
forwards exactly six keys per input — `name`, `type`, `required`, `enum`, `binding`,
`description` — so an authored `inputType` could not reach the published
`sdui.manifest.json` even in principle.

Option A — teach `sdui-parser` to forward the key — is REFUSED on record. The only thing
that looked like demand for it was a write that had never taken effect, and a write nothing
reads is not demand for a feature. The neighbouring 2026-08-17 expression-ceiling ruling
(quoted on `ComponentInput.type`) is untouched and stays deferred, with its reopen
condition — a measured case of an author shipping a spec-rejected value objectui's silence
let through — unchanged.

Deleting the member outright was again the option NOT taken, for the reason the four
siblings established: `ComponentInputSchema` is a non-strict `z.object`, so an undeclared
key is silently STRIPPED. The tombstone is what converts a write from OUTSIDE this
repository — the half objectui#5905 could not measure — into a named refusal carrying its
own remedy, with `code: 'invalid_type'` and the key named in the issue `path`.

Accept-set change, stated plainly for reviewers: a document that sets `ComponentInput.inputType`
used to parse GREEN (the value was then dropped by the serializer) and now parses RED. That
is the intended effect and the reason this carries a contract-review label.

Three pins were FLIPPED rather than deleted, so the closure stays asserted instead of
becoming a silent absence: `plugin-markdown`'s `index.test.ts` (which asserted the write)
now asserts the key's absence plus a `tsc` refusal at that package's own authoring site,
and the two fork-half controls in
`packages/types/src/__tests__/component-input-retired-constraint-keys.test.ts` — one
type-level, one parse-level — now assert refusal where they asserted liveness.

Stale wording corrected in the same pass, because this change falsifies it: `base.ts` and
`zod/base.zod.ts` both said the fork was "recorded for a ruling; until then this stays a
live, writable key", and `widget.ts` called it "the open fork". All three now record the
ruling. A reader who greps the source instead of the card thread was meeting an open fork
that no longer existed.
