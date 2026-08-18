---
'@object-ui/plugin-grid': patch
---

The plugin-grid documentation-site page now spells keys the grid actually reads.

`content/docs/plugins/plugin-grid.mdx` is the docs-site mirror of the README pass
in objectui#5065, and carried the same defect end to end: the `### Grid` sketch,
the column definition and every example block declared `type: 'grid'` with
`header` / `accessorKey` columns.

Bare `grid` is deliberately not this plugin's key — the `view:grid` registration
passes `skipFallback: true` (`packages/plugin-grid/src/index.tsx`), because `grid`
belongs to the CSS Grid *layout* container in `@object-ui/components`, whose
`columns` is a column **count** rather than a column list. A reader copying an
example therefore rendered a layout container, not a data grid. The registry
confirms this in both plausible host import orders: `object-grid`,
`plugin-grid:object-grid` and `view:grid` all resolve to `ObjectGridRenderer`,
while bare `grid` resolves to the layout container.

The column vocabulary was rejected rather than ignored: `ListColumnSchema`
(`@objectstack/spec/ui`) is a **strict** Zod object, so `header` and `accessorKey`
fail validation with `unrecognized_keys` — the identity key is `field` and the
header is `label`. Likewise `object` is not a key (`objectName` is required and
there is no `object`), `pagination` carried a `showSizeChanger` that the strict
`PaginationConfig` rejects, `rowActions` was written as inline definitions with
callbacks and then as `true` when it is a `string[]` of action names, and the
top-level `sortable` / `filterable` switches have zero read points anywhere in the
package — sorting is the per-column `ListColumn.sortable` and filtering is the
metadata `filter` plus `searchableFields`.

The five `on*` names were taught as schema keys; they are React props on
`ObjectGridComponentProps`. A schema is a serialisable document and cannot hold a
function, and the renderer never reads a callback off the schema.

Every block is rewritten against the declared authoring surface
(`GRID_QUERY_INPUTS`), matching the README pass so the two teaching surfaces no
longer disagree. The TypeScript section additionally fixes the grid third of
objectui#5086: it imported `GridSchema` / `GridColumn` from
`@object-ui/plugin-grid`, and neither name is on that package's 49-name export
surface — both are taken elsewhere by unrelated types (`GridSchema` in
`@object-ui/types` is the CSS Grid layout container; `GridColumn` in
`@object-ui/fields` is a column of the line-items form widget, keyed `name`). It
now imports `ObjectGridSchema` / `ListColumn` from `@object-ui/types`, with no new
re-export added to make the old path work.

Documentation only — no renderer behaviour changes, and no capability was added to
make an example true.
