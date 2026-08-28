---
"@object-ui/plugin-form": patch
---

`record:line_items` declines to LOAD OR WRITE the rows of a panel whose child object it never resolved, instead of calling `find(undefined, …)` — the sibling site of the child-schema decline, in the same component.

`LineItemsPanel` read `schema.childObject` at two sites. The first now declines; the row load still
asked the data layer to `find` an object literally named `undefined`, scoped by
`{ [relationshipField]: parentId }`. `load` guarded the *data source* and the *parent id* — the two
things `RelatedList` calls "can I scope this query" — but not the *object being queried*.

Declining that fetch is not enough on its own, and this is the part worth reading: `load` owns
`loading`, and the panel branched `loading ? "Loading…" : !parentId ? "Save the record first…" :
<grid>`. So the moment the fetch declined, an unresolvable panel with a parent id bound fell to the
third branch and showed an **empty editable grid with an Add button, over an object that does not
exist** — a worse outcome than the fetch it replaced. Measured on the pre-fix component: one
keystroke in the grid's always-present ghost row materialised a row, which enabled Save, which
reached `batchTransaction([{ object: undefined, action: 'create', data: { qty: 3, invoice: 'inv-1' } }])`.
The bad *read* was one keystroke away from a bad *write*.

An unresolvable panel therefore gets its own render branch — a config hint naming `childObject` and
what to set it to, following the precedent `object-master-detail-form` set for this exact key and
`AdvancedChartImpl`'s refusal placeholders. It is checked ahead of `loading`, because nothing is
pending: the schema itself already says the panel can never resolve, so there is no honest moment at
which "Loading…" is true. `save` takes the same one-line guard, for the one route the render branch
cannot close — a schema edited to drop `childObject` while rows are already dirty.

A panel that names its child object loads, renders and saves exactly as before.
