---
---

Pins the flow-node `label` at the PRODUCER, where a cast cannot bypass it
(objectui#6331), and records why the reader-side type stays optional so the
question is not re-opened a third time.

`FlowNodeSchema` requires `label`; the designer's `FlowDesignerNode` makes it
optional, and that is a deliberate layer difference — a canvas holds nodes the
user has dropped but not finished. Both hold only if something guarantees a node
ACQUIRES a label before save. A census of every construction path (canvas
palette/append, insert-on-edge, the one-click revision loop, the empty-flow
seed, the Studio "New flow" skeleton, plus the nested-region and drag writers,
which re-spread an existing node) found six node literals across five producer
call sites and every one already writing a label — but three of the five were
enforced only by accident. Measured on `origin/main` by deleting the `label`
line from `insertOnEdge` and from `FlowPreview.handleAddNode`: vitest green
(58/58), `tsc` exit 0, `eslint` exit 0 with zero errors.

`flow-node-producers.label.test.tsx` closes that in two halves — each producer
driven through its real affordance with the EMITTED node `safeParse`d whole
against the spec (never a hand-composed node, which is what let the existing
seed test stay green through the ablation), plus a source census that refuses a
node literal writing no label, so a producer added later lands red there instead
of at the author's save.

No runtime behaviour changes; the published types are untouched.
