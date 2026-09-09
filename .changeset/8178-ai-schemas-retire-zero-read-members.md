---
'@object-ui/types': minor
'@object-ui/plugin-ai': minor
---

Retire the seven zero-read members of the three AI schemas, and the designer
inputs that advertised them (objectui#8178, ADR-0049 enforce-or-remove,
director decision batch #78, 2026-09-07, maintainer verbatim 「同意」).

**Breaking, deliberately — and scored `minor` per this repo's convention**
(objectui#3161 family: a `major` in the fixed group pushes all 39 packages off
`@objectstack`'s cadence, so breaking semantics are spelled out here instead;
`scripts/check-changeset-no-major.mjs` enforces it).

`AIFormAssistSchema.formId` / `.objectName` / `.fields` / `.autoFill`,
`AIRecommendationsSchema.objectName` / `.maxResults` and `NLQuerySchema.objectName`
are `?: never` retirement tombstones. A node that carries one is now a
compile-time error on the published `.d.ts`; a stored JSON document that carries
one keeps parsing exactly as it did, and the value keeps being ignored, exactly
as it was. Seven `inputs` entries across the three `ComponentRegistry`
registrations are gone, so the field designer no longer offers the keys, and the
`packages/plugin-ai/README.md` examples that taught them are rewritten.

**Nothing behavioural changes.** Not one of the seven had a reader. The census
was re-derived per key on this branch's base with a lit control beside every
zero — `AIFormAssist` 0 for `formId`/`objectName`/`fields` against `suggestions`
9 and `showConfidence` 2; `AIRecommendations` 0 for `objectName`/`maxResults`
against `recommendations` 8; `NLQueryInput` 0 for `objectName` against `result`
14 — plus the two channels that consume a key without naming it: zero
`{...props}` / `{...rest}` spreads in all four of the package's sources (control:
`collapsible.tsx` matches the same patterns) and zero dynamic `schema[…]` access
(control: four files under `packages/` use that form). `autoFill` was the one
non-zero: destructured with a default and never referenced again, so nothing was
ever auto-filled.

`maxResults` is the member that made this user-visible. It was documented as
"Maximum number of results to display" and read by nothing, so `maxResults: 5`
against a fifty-item list rendered fifty rows with no diagnostic.
`AIRecommendations` now STATES in its docblock that it renders every item and
that there is no cap, and a fifty-item render pins it in both layouts.

**Migration.** Slice `recommendations` before handing it over; pass
`suggestions` in and act on `onApply` instead of `formId` / `fields` /
`autoFill`; scope a query by object in the host that answers it instead of
`objectName`. The README carries the same table.

**Why not Enforce.** Implementing reads nobody asked for is capability growth
without pull, and nothing in the repo pulls on these. An AI backend that later
wants `objectName` / `fields` as call context is a feature card with its own
business case.

**Why tombstones and not deletions.** All three schemas extend `BaseSchema`,
which carries `[key: string]: any`: a deleted optional member is absorbed
silently at any value, defeating both excess-property checking and the weak-type
check. Deletion would have left precisely the silent no-op this retirement ends,
and the ruling's first pin — refused by the schema types, at compile time —
would have been unsatisfiable. `packages/plugin-ai/README.md` taught all seven as
working, which is prong 2 of the tombstone discriminator (objectui#5941, #7526,
#7678) on its own.

`AIInsightsSchema.objectName` is deliberately untouched: the ruling names three
schemas, and that fourth one was neither screened nor decided. A pin holds it at
`string | undefined` so a later sweep of "the AI `objectName`s" cannot take it
quietly.
