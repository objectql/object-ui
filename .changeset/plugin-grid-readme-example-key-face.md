---
'@object-ui/plugin-grid': patch
---

plugin-grid's README examples now spell keys the grid actually reads.

Ten example blocks and the `### Grid` sketch documented an authoring surface that
does not exist. Every one declared `type: 'grid'`, which is deliberately NOT this
plugin's key — the bare `grid` registration is `skipFallback: true`
(`src/index.tsx:193`), because `grid` belongs to the CSS Grid *layout* container in
`@object-ui/components`. A reader copying an example therefore rendered a layout
container, not a data grid, and its unrecognised props leaked into the DOM as
invalid HTML attributes (objectui#4787 is that runtime symptom; this is its
documentation-side cause).

The keys inside those blocks fared no better. `sortable`, `filterable` and `object`
have zero read points anywhere in the repo — sorting is per column
(`ListColumn.sortable`), filtering is the metadata `filter` plus `searchableFields`,
and the object is `objectName` (required). `onRowClick`, `onSelectionChange`,
`onCellChange`, `onRowSave` and `onBatchSave` are React props on
`ObjectGridComponentProps`; a schema is a serialisable document and cannot carry a
function, and the grid builds the inner table's handlers itself rather than reading
any callback off the schema. Columns were written `{ header, accessorKey }` against
a **strict** `ListColumnSchema` whose column is `{ field, label, … }`; `data` was
written as a bare row array against a `ViewData`; `pagination` carried a
`showSizeChanger` that its strict config has no room for; and `rowActions` was
written as inline definitions with callbacks, then as `true`, against a `string[]`
of action names.

Every block is rewritten to the declared surface (`GRID_QUERY_INPUTS`,
`src/index.tsx:145`) and annotated `ObjectGridSchema` — the annotation is the point,
since an un-annotated `const schema = { … }` type-checks whatever is written in it.
Documentation only; no renderer behaviour changes, and no capability was added to
make an example true.
