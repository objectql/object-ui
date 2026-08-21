---
'@object-ui/components': minor
---

The static `table` renderer reads only the declared `TableColumn` contract, and its published reference page teaches that spelling.

`renderers/complex/table.tsx` resolved a heading as `col.header || col.label` and a
cell as `row[col.accessorKey || col.name]`. Neither `label` nor `name` is declared
on `TableColumn`, which declares `header` and `accessorKey` — both required
(`packages/types/src/data-display.ts`). This was the fourth site of the
column-alias family, after `data-table`, `ObjectDataTable` and `ObjectGrid`
(objectui#5350).

Both aliases are retired. The ruling recorded on objectui#5120 (2026-08-20) is the
family direction — *retire the consumer-side alias; unify the producers* — and it
names this site: the declared `header`/`accessorKey` contract wins.

What makes this site different from its three siblings is that the alias was not
merely tolerated, it was **published**. `content/docs/api/schema-reference.md`
§TableSchema shipped a copyable `{ "name": "id", "label": "#" }` example and a
property row reading *"Column definitions with `name`, `label`, …"*, while
`packages/types` declared the opposite pair. Docs and type disagreed about one
type they both call `TableColumn`, each internally consistent. Retiring the alias
without correcting the page would have turned a documented, working example into a
silently broken one, so both halves land together: the page now authors
`accessorKey`/`header`. The same row also advertised a `render` property that
`TableColumn` has never declared — the renderer's hook is `cell` — and that claim
is dropped rather than re-spelled.

The failure mode of a now-unresolvable column is worth stating, because it is
quiet: the column keeps its slot and its neighbours are unaffected, the header or
the cells simply render empty, and nothing throws. This renderer keys its cells by
index rather than by accessor, so unlike `data-table` it does not even produce
React's generic missing-key warning — a retired-spelling column is fully silent.
Whether that silence should become an authoring diagnostic is objectui#5349's
question; no diagnostic is added here.

The two `columns.map` callbacks are typed `TableColumn` instead of `any`, so
re-introducing an undeclared alias on this renderer is now a type error rather
than a reviewer's catch.
