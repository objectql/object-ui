---
'@object-ui/core': minor
'@object-ui/components': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-detail': minor
---

`data-table` reads only the two column keys it declares; the producers translate.

`TableColumn` declares `header: string` and `accessorKey: string`. The renderer's
column normalization nonetheless read `header: col.header || col.label` and
`accessorKey: col.accessorKey || col.name` — two undeclared aliases for two
declared keys, so the same key had one spelling the type admits and one only the
runtime did. Both aliases are now gone (objectui#5120, objectui#5351), and the
translation that used to happen inside the adapter happens once at each producer
instead: metadata vocabulary in, adapter vocabulary out, one place.

**This narrows what `data-table` accepts, so read this if you author `data-table`
nodes by hand.** A column spelled `{ name, label }` on a directly authored
`data-table` no longer resolves: `name` gives blank cells under a live header,
`label` gives a headerless column over live cells. Neither is dropped and neither
throws. Spell such a column `{ accessorKey, header }` — the two keys `TableColumn`
has always declared. Columns reaching `data-table` through `object-data-table`,
`object-grid` or a related list are unaffected; those producers resolve both keys
for you, and every spelling they accepted before they still accept.

`@object-ui/core` gains `columnHeader()` alongside `columnIdentity()` — the reader
producers use to cross that boundary, adapter-first (`header` wins over `label`,
so an author who addressed the table directly is never overwritten).

`object-data-table` also gains a fix from the same move: a column carrying a
`label` used to render a **blank** header there even while the alias existed,
because the widget's field-meta enrichment overwrote the authored `label` before
the adapter ever saw it. `{ field: 'stage', label: 'Stage' }` now renders "Stage".
