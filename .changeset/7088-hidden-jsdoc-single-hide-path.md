---
'@object-ui/types': patch
---

Correct `BaseSchema.hidden`'s JSDoc: it hides by NOT RENDERING, exactly as
`visible: false` does (objectui#7088, maintainer ruling 2026-09-01).

The declaration promised "Controls whether the component is hidden (but still
rendered) … component is rendered but not visible (visibility: hidden)". The
renderer has never done that. `visible`, `visibleWhen`, `visibleOn`,
`visibility`, `hidden` and `hiddenOn` are legs of one `shouldHide` chain in
`SchemaRenderer`; every leg feeds the same `_hidden` flag, and `_hidden` has
exactly one consumer — `if (evaluatedSchema._hidden) return null`. No node
survives for either key, and nothing in the repo emits a `visibility` style. The
sibling `visible` comment claimed `display: none` on the same false premise and
is corrected with it.

**Comment-only — no behaviour moves.** The other reading, keeping the node in the
tree and hiding it visually, was weighed and **declined**: it is a behaviour
change on a published prop with zero named consumers, so an accessibility or
animation use-case that wants it reopens the question as its own feature card.
The JSDoc now records the synonymity as a decision, so the next reader does not
read "two keys" as "two behaviours", and notes that synonymous in OUTCOME is not
synonymous in PRECEDENCE — a declared `visible` short-circuits `hidden`, which
is unchanged and pinned elsewhere.

Why a comment was worth a changeset: the JSDoc is the authority a later docs
correction is measured against, and this one nearly propagated. While splitting
the schema-reference `hidden` row, a reader checked it against `base.ts` and
almost "corrected" the table's "Inverse of `visible`" — the half that describes
shipped behaviour — toward the declaration. That row is unchanged and stays.
`SchemaRenderer.hiddenVisibleSynonymy.test.tsx` now pins the claim the comment
makes: the two keys produce the same rendered output, and `hidden: true` leaves
no node that could carry a `visibility` style.
