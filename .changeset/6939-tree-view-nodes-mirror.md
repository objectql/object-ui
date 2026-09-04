---
'@object-ui/types': patch
---

Repair the `tree-view` mirror: `data` is optional, so the `nodes` spelling the
renderer reads FIRST is a legal document on its own (objectui#6939, maintainer
ruling recorded 2026-09-02 — this is one of the eight groups on that card,
dispatched as its own PR per the ruling).

`TreeViewSchema` REQUIRED `data`, the limb the renderer reads THIRD:

    const rawNodes = boundData || schema.nodes || schema.data || [];
    // packages/components/src/renderers/data-display/tree-view.tsx:105

The registration's own `inputs` and `defaultProps` spell it `nodes`, and the
four `components-data-display-tree-view/*` catalog entries ARE those
`defaultProps` — so `safeValidateSchema` refused every one of them
(`: Invalid input`) while the renderer drew them correctly. Re-measured on
`origin/main` at `fe4e7a9e8`: four refusals, and four renders that are
byte-identical under either spelling (28 / 28 / 12 / 34 elements, same tag
census, same `textContent` SHA-256). Identical output under the "correction" is
objectui#6318's own triage test for *the schema was the wrong side*.

**For AUTHORS this widens on both faces.** `data` goes from required to optional
on the mirror and on the TypeScript twin in the same stroke; nothing that
validated before validates less, and no document that type-checked as a literal
stops doing so. A document authored on `data` — such as the tree-view entry in
`packages/types/examples/data-display-examples.json` — is untouched, and both
spellings together stay legal.

**For a READER of the TypeScript twin this is a narrowing, and that is the half
worth stating.** `TreeViewSchema['data']` is now `TreeNode[] | undefined`, so
code that read `schema.data` and relied on its presence needs a guard and will
otherwise stop compiling (measured on a consumer probe: exit 0 before, `TS2322`
plus `TS18048` after). The only in-repo reader already has that guard —
`renderers/data-display/tree-view.tsx:105` reads
`boundData || schema.nodes || schema.data || []` — and it type-checks clean, so
nothing in this repository changes. An out-of-repo consumer that reads the key
unguarded is the population this paragraph exists for.

Still `patch`: the required-ness was never a guarantee the renderer honoured (it
reads the key third, behind a default), the accept set only grows, and this is
the same shape as the two sibling groups of this card that have already landed.

**`data` stays DECLARED rather than being deleted**, and the difference is
measured rather than assumed: `BaseSchema` already declares `data`
(`z.any().optional()`; `data?: any` on the TS face), so removing the member
would not reject the key — it would admit it *unvalidated* while the renderer
went on reading it. Optional-and-typed is the only shape in which `declared` and
`enforced` agree for a key that is still read.

**No refinement was added**, deliberately, unlike this card's
`object-map` / `object-gantt` group. A tree-view carrying no data source at all
becomes legal here, and that admits no new rendering outcome: `{ data: [] }` was
already legal and already drew the same empty tree, so an "at least one of
`nodes` / `data` / `bind`" rule would forbid a spelling of an empty state the
contract already permits rather than buy a guarantee.

`nodes` and `title` are objectui#6150's declarations and are unchanged; that
card declared the reads and said in as many words that relaxing `data` was a
separate accept-set change. This is that change.
