---
'@object-ui/types': minor
'@object-ui/plugin-detail': minor
---

**Retired: `DetailViewSection.hideEmpty`.** The `record:details` section key is
gone from `@object-ui/types` and `RecordDetailsRenderer` no longer reads it.
Emptiness on a detail section is now decided entirely by `DetailSection`'s
auto-hide heuristic — hide empty rows only while the section still has at least
one filled row, never on an all-empty section — with the reader's
"Show N empty fields" toggle as the escape hatch.

**Minor, not major, and deliberately so.** The key was never authorable on any
validated page: `@objectstack/spec` `RecordDetailsProps` REFUSES it, returning
`unrecognized_keys: ['hideEmpty']` on the `sections[]` element (measured on the
installed 17.2.0, against a `columns: 2` control that parses and whose value
survives). So a spec-compliant document could not carry the key, and a document
that carried it anyway failed to parse before it ever reached the renderer.
What this release removes is a *declaration* that invited authors — and code
generators reading the published `.d.ts` — to write a key the platform refuses.
That narrows a published type surface, which is what makes it a minor rather
than a patch; it retires no capability anyone could exercise.

One key had four contracts and three answers: `@object-ui/types` declared it,
`RecordDetailsRenderer` honoured it, the `DetailViewSectionSchema` zod mirror
omitted it, and the spec refused it. The maintainer converged the four on the
spec's answer (2026-09-01): the spec keeps refusing, the mirror stays absent,
and the declaration and the read are retired. All four are now pinned together
in `record-details.hideEmptyRetired-7129.test.tsx`.

Going with it is the paradox the key carried: `DetailSection` tested
`!section.hideEmpty`, so an authored `hideEmpty: false` was indistinguishable
from an unauthored section and overrode nothing. There is no longer a lever to
misread.

**Supersedes one paragraph of the `record:details` empty-section changeset in
this same release.** Its closing "What does not change: an authored `hideEmpty`
keeps its exact former meaning" no longer holds — an authored `hideEmpty` of
either polarity is now inert, and the release notes should read that way.
Everything else in it stands: the unauthored default is unchanged, and so is
the label-graveyard guard.

**Migration:** delete `hideEmpty` from any `record:details` section you author.
A section that used `hideEmpty: true` to hide an all-empty block will now show
that block's skeleton — headings, field labels and one empty-value placeholder
each. That is the platform's answer for a sparse record, and it is a UI
decision, not something metadata should have to make.

**Not affected**, despite the shared name: `record:reference_rail`'s own
`hideEmpty` prop, which is a different surface and still live; and the
`detail.hideEmptyFields` i18n label behind the toggle.
