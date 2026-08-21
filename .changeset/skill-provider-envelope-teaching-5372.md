---
---

Published-skill teaching only — this publishes nothing, declared explicitly with an
empty frontmatter rather than left undeclared. No package `src/` is touched: the
change is confined to `skills/objectui/**` (the published skill package) plus one new
test under `packages/components/src/__tests__/`, which pins the corrected teaching to
the real renderer.

The rules told authors that the `properties` / `props` envelope belonged to the
`element:*` namespace and that every other key "lives on the node". Measured on a real
`SchemaRenderer` inside a `SchemaRendererProvider`, `properties` is evaluated and then
hoisted onto the node in *every* namespace — so it was the only spelling that reached a
`data-table`'s rows from a provider `dataSource`, while the node-level and `props`
spellings rendered a header over the empty state with nothing thrown and nothing logged.
The guides now record that measurement instead of contradicting it.
