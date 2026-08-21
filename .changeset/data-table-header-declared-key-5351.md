---
'@object-ui/core': minor
'@object-ui/components': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-detail': minor
---

`data-table` reads the declared `header`; the producers translate `label` into it.

`TableColumn` declares `header: string` and does not declare `label`. The
renderer's column normalization nonetheless read `header: col.header || col.label`,
so the same key had one spelling the type admits and one only the runtime did.
That alias is gone (objectui#5351), and the translation it used to perform happens
once at each producer instead: metadata vocabulary in, adapter vocabulary out.

**This narrows what `data-table` accepts, so read this if you author `data-table`
nodes by hand.** A column spelled `{ label: 'Stage', accessorKey: 'stage' }` on a
directly authored `data-table` now renders a **headerless** column over live
cells. Spell it `header` — the key `TableColumn` has always declared. Columns
reaching `data-table` through `object-data-table`, `object-grid` or a related
list are unaffected: those producers resolve `header` for you from the spec's
`ListColumnSchema.label`, so every spelling they accepted before they still
accept.

`@object-ui/core` gains `columnHeader()` alongside `columnIdentity()` — the reader
producers use to cross that boundary. It is adapter-first (`header` wins over
`label`), so an author who addressed the table directly is never overwritten.

`object-data-table` also gains a fix from the same move: a column carrying a
`label` used to render a **blank** header there even while the alias existed,
because the widget's field-meta enrichment overwrote the authored `label` before
the adapter ever saw it. `{ field: 'stage', label: 'Stage' }` now renders "Stage".

The sibling `accessorKey: col.accessorKey || col.name` alias is **unchanged** here
and still resolves. Retiring it is objectui#5120's remaining step, which is
gated on two published skill guides that teach that spelling.
