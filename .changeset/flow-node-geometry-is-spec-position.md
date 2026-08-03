---
"@object-ui/app-shell": minor
---

The flow designer writes node geometry as the spec's `FlowNode.position`, not its
own `ui: { x, y }` (objectui#3172).

FROM: dragging, adding-at-a-point and insert-on-edge each wrote `node.ui = {x, y}`
— a fourth-generation local spelling of a concept `@objectstack/spec` has modelled
as `FlowNode.position` all along. TO: all three write `position: { x, y }`, and the
canvas migrates on write: a stored flow's legacy `ui` is lifted onto `position` and
the key removed in the first patch the canvas emits, geometry-related or not.

**This is a behaviour fix, not a rename.** `FlowNodeSchema` has been `.strict()`
since objectstack#4001, so `ui` is an `unrecognized_keys` error: the live client
validation flagged the draft on every keystroke and the server rejected the save
with a 422. In other words, dragging a node made the flow unsavable — the
convergence is what makes the designer's most basic gesture round-trip again. A
test now parses `{ …node, ui: {x, y} }` through the spec's own schema and asserts
the rejection, so the claim is executed rather than argued.

Reading is backwards-compatible: `manualPosition()` prefers `position` and falls
back to a legacy `ui`, so a flow stored before this change still opens with its
nodes exactly where the author left them (pinned by a test that lays out both
spellings and compares the maps). The fallback is a migration path, not a second
contract — nothing writes `ui`, and the canvas strips it at its input boundary, so
no patch can re-emit it.

The geometry type is now derived from the spec by reference
(`FlowNodePosition = NonNullable< SpecFlowNode['position'] >`), and
`spec-symbol-parity.test.ts` pins the equality in both directions — including that
both coordinates are required, so a half-position stays unrepresentable. The
shape-copy in `FlowPreview.tsx` is gone; it reads the canvas's own node type, the
way it already read the canvas's edge type.

Breaking for anyone reading `node.ui` off a flow draft: after the author's first
edit the key is gone and the coordinates live under `node.position`. Nothing in
this repo or the engine read it — it was a designer-local key the schema rejected.
