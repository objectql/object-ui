---
---

Docs and catalog fixtures only, no shipped code touched: the two `plugin-grid` catalog
entries are now real `object-grid` nodes instead of hand-built static card layouts.
`content/docs/plugins/plugin-grid.mdx` mounted `product-inventory-grid` and
`team-members-grid` under `PluginLoader plugins={['grid']}` while both authored only
`badge button card flex stack text` — pictures of a grid, not a grid. They are replaced
by `object-grid-columns` (a `ListColumn` set with `sort`, `searchableFields` and
`pagination`) and `object-grid-selection-summaries` (multi-row `selection`, named
`rowActions` / `bulkActions`, per-column footer `summary` roll-ups), both querying the
docs gallery's demo data source the same way the `plugin-view` entries have since
objectui#5113.

The two mock-ups are legitimate static layouts filed under the wrong plugin, so they are
re-seated into `components-layout-card` as `inventory-table-card` and `team-roster-card`
rather than deleted — deleting a catalog entry moves three corpus-wide counters
(`NODE_CENSUS` in `layout-dom-leak-5574.test.tsx`, and the `className`-carrying layout
node and `stack` node floors in `layout-props-conversion.test.tsx`), and a floor that
moves because a fixture was deleted is indistinguishable later from one that moved
because coverage regressed. All three are unchanged, with no floor edited.

objectui#5113's pin in `catalog-gallery-render.test.tsx` is extended to cover
`plugin-grid` through an explicit two-entry category/type map, keeping both of its halves
— every entry authors the type its own package registers, and the rendered tile shows a
record that exists only in the gallery's data source.
