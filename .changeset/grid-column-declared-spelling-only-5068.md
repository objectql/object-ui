---
"@object-ui/plugin-grid": minor
---

fix(plugin-grid): `ObjectGrid` reads the declared column spelling, and only it

`ObjectGridSchema.columns` is declared `string[] | ListColumn[]`, and
`ListColumnSchema` in `@objectstack/spec/ui` is a **strict** object: `field` is
required, and `accessorKey` / `header` are refused **by name** —
`unrecognized_keys`, with a prescriptive message. The renderer accepted that
refused spelling anyway, through a branch that sniffed `columns[0]` for an
`accessorKey` and synthesized a `ListColumn` from it. One key, two spellings:
one the schema admits, one only the runtime did.

That branch retires (inheriting the disposition of objectui#3951 together with
its reason — unify at the producer, no consumer-side tolerance alias, AGENTS.md
#0.1). It is also why the fictional `{ header, accessorKey }` column interface
in the plugin README (objectui#5013) read as credible: it rendered, so nothing
signalled that the contract refuses it.

**Affected input.** A column authored `{ accessorKey, header }` no longer
resolves; it is dropped, and a grid whose columns are all mis-spelled renders as
the row-number column alone. Write columns the declared way — `{ field, label }`
— which is what the spec has always accepted and what the docs have always said
(`content/docs/plugins/plugin-grid.mdx`: "The field this column reads. There is
no `accessorKey`."). No authored usage of the retired spelling exists in this
repo's examples, docs, apps or fixtures; every in-repo occurrence of the name
belongs to the `table` / `data-table` component, which legitimately owns it.

The `columns[0]` sniff goes with the branch. Column identity is a per-column
property, and one filter now judges it: a mis-spelled column is dropped alone,
where the sniff let the first entry decide the fate of the whole array — a
declared column standing behind an undeclared one was lost with it, and the
reverse order threw a `TypeError` mid-render.

`accessorKey` keeps its job on the way **out**: it is the data-table adapter's
column key, which `@object-ui/core` deliberately holds outside the metadata
identity fold (`TABLE_ADAPTER_COLUMN_KEY`) and which `ObjectGrid` still writes
when it hands columns to the adapter. Metadata vocabulary in, adapter vocabulary
out, one translation at one boundary.
