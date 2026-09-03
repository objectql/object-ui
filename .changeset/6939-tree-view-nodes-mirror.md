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

**This is a WIDENING, on both faces.** `data` goes from required to optional on
the mirror and on the TypeScript twin in the same stroke; nothing that validated
before validates less. A document authored on `data` — such as the tree-view
entry in `packages/types/examples/data-display-examples.json` — is untouched,
and both spellings together stay legal. Hence `patch`, matching the two sibling
groups of this card that have already landed.

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
