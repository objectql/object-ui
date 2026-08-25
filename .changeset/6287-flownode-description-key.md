---
'@object-ui/app-shell': patch
---

The flow designer's node inspector no longer offers a **Description** field, and strips a
stored `description` off a node the first time an author edits it (objectui#6287).

`FlowNodeSchema` is `.strict()` (objectstack#4001) and refuses that key by name — measured
on the installed `@objectstack/spec@17.2.0`:

```
FlowNodeSchema.safeParse({ id, type, label, description, config })
  -> unrecognized_keys: ["description"]
```

By this package's own reading of that mechanism, the cost is not untidiness but an
unsavable draft: the key "surfaces as `unrecognized_keys` in the live client validation and
as a 422 on save" (`flow-canvas-layout.withCanonicalGeometry`, on the identical retired `ui`
case). So the field was not merely describing a shape the contract refuses — it was
producing one, on every keystroke, and nothing anywhere read the value back. The spec's flow
node has eleven keys and no note key of any spelling, so there was no reader to grow into.

Stored flows heal on the author's first edit, the same migrate-on-write boundary the retired
`ui` geometry gets, and for the same reason: with the field gone there would otherwise be no
way left to clear a `description` an author had already saved.

The three hand-written copies of the node and edge shapes that let this drift go unseen are
now one declaration each — `FlowNodeInspector`'s node and edge types alias the canonical
`FlowNodeLike` / `FlowDesignerEdge`, and `flow-decision-edges`' fourth edge copy aliases the
same canvas edge instead of restating it with a `condition?: unknown` that had already
outlived objectui#3202's narrowing by months.
