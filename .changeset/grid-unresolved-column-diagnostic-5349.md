---
'@object-ui/plugin-grid': patch
---

`ObjectGrid` says which column it dropped, instead of rendering a header-only grid in silence.

objectui#5068 retired the undeclared `accessorKey` / `header` tolerance branch, so
`ListColumnSchema`'s `field` / `label` is now the only column spelling the renderer
reads. That was right — the spec refuses `accessorKey` and `header` by name, and the
census found zero authored usages. But it relocated a failure mode instead of removing
it: a column authored in a spelling the renderer does not read contributed nothing, and
nothing said so. No error, no warning, no empty state — the author got a grid with its
row-number column and no data columns, which is a success receipt for a disagreement
between the renderer and the author.

An authored column that can never resolve now emits one `console.warn` naming the
address rather than the symptom: which block (`object-grid` or the `view:grid` alias),
which object and label, which `columns[i]`, the keys that entry actually carries, and the
rewrite that works — for a column authored `{ accessorKey: 'amount', header: 'Amount' }`
the message spells out `{ field: 'amount', label: 'Amount' }`. It reuses the channel `ObjectGrid` already had for "you declared it, the renderer dropped
it" (the export-format warning), rather than adding a second differently-shaped one.

Rendering is unchanged in every case: this is additive. The diagnostic reads the
`columns` input and nothing else — it never asks whether the grid found rows, because
`object-grid` legitimately draws them from five different places (a bare `data` array,
`data.provider: 'value'`, legacy `staticData`, `bind`, or a host that owns the fetch and
passes the window down as a `data` React prop, which is what `plugin-list`'s `ListView`
does). All five are pinned by test, in both directions. A `hidden: true` column is
authored intent and is never reported, and so are the arms that legitimately produce no
columns of their own: no `columns` key, an empty `columns` array, and the `string[]`
spelling.

A throw was rejected: a grid that renders nothing today would become a page that renders
nothing.
