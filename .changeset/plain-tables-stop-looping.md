---
"@object-ui/components": patch
"@object-ui/plugin-dashboard": patch
---

fix(components,plugin-dashboard): a static-data `table` widget renders instead of crashing

A dashboard widget authored as `{ type: 'table', options: { data: [ … ] } }` fell into the
error boundary with "Maximum update depth exceeded" the moment its tile re-rendered, while
every chart family on the identical static surface rendered clean.

- `data-table` no longer re-renders itself to death. Its `columns` / `data` fallbacks are
  module-scope empties instead of per-render array literals, and the prop→state column sync
  re-seeds on a value change rather than on a new identity — so a consumer that derives its
  columns each render (which both dashboard surfaces do) costs the table nothing.
- Both dashboard surfaces now give the static table the `columns` key `DataTableSchema`
  requires, derived from the rows when the author declared none — the same derivation the
  `provider: 'object'` half of the widget family already performed. Previously such a table
  drew one empty row per record: no headers, no cells.
- `DashboardGridLayout` reads an authored `options.data` ARRAY for its static table, which
  its `widgetData?.items` expression resolved to `[]`. `DashboardRenderer` had the arm all
  along.
