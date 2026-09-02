---
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': minor
---

`record:details` section headings converge on the declared `label` slot; the
`title` alias limb is gone (objectui#6190, maintainer ruling 2026-08-31 —
option A, three producers plus the consumer in one change).

**Breaking for anyone reading `deriveFieldGroupDetailSections`' output — the
emitted key moves from `title` to `label`.** That function is public API
(exported from `@object-ui/plugin-detail`), so this is an output-shape change,
not an internal refactor. A caller that reads `section.title` off its return
value reads `undefined` after this release and must read `section.label`.
`BuildPageOptions.sections` and `ObjectDefLike.sections` declare the same move,
so a caller passing `sections` into `buildDefaultPageSchema` supplies the
heading as `label` too.

**The retired authoring spelling is `title` on a `record:details` section.**
`RecordDetailsRenderer` read `s.title ?? s.label` — a strict-priority second
spelling of one slot, with byte-identical localization on both limbs, so a
producer emitting both silently disagreed with itself and `title` won. It now
reads `label` only. Nothing an author could publish is affected: `@objectstack/spec`
REFUSES `title` inside a `sections[]` entry (`unrecognized_keys`, pinned by
objectstack#11902), and `@object-ui/types` plus the authoring inspector have only
ever declared `name` / `label` / `columns` / `fields`. The declared and authoring
faces were already converged; only three runtime producers lagged, and all three
move here:

- `buildDefaultPageSchema`'s `deriveFieldGroupDetailSections` section literal;
- `RecordDetailView`'s re-map of that output through the per-object i18n
  convention;
- `RecordDetailView`'s auto-grouped "More details" section, authored in
  app-shell and unreachable from the synthesizer.

**No rendered heading changes.** Every existing producer yields byte-identical
headings, asserted by rendering rather than by inspection — including the
"More details" bucket, which the earlier two-step scope would have degraded to
the literal `details` in every shipped locale while every existing guard stayed
green. A new pin (`RecordDetailView.sectionHeadingsRenderPath-6190.test.tsx`)
walks the tree app-shell actually renders and closes that blind spot.
