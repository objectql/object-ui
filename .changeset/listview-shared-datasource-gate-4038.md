---
"@object-ui/plugin-list": patch
---

`list-view` now reads its `dataSource` binding through the shared `ElementDataSourceGate` instead of a private copy of the precedence table

objectstack#5576 landed the per-element `dataSource` binding on `list-view` by
writing the precedence table — binding keys override the component's, a `view` is
only a baseline, `filter` AND-combines rather than replaces, an authored-but-empty
`columns` counts as unauthored, the row cap lands on `pagination.pageSize`, and
`viewType` is taken only when the component declared none — inline in
`ListViewBlock`. objectstack#6953 then needed the same table for the other eight
object-bound blocks and lifted it into `@object-ui/react`
(`useElementDataSourceSchema` / `ElementDataSourceGate`), deliberately not
touching `ListViewBlock`: refactoring already-merged code inside a wiring PR
would have been an out-of-scope regression surface.

That left one table with two implementations — `list-view` on the private copy,
every other block on the shared one. Nothing was wrong for a user today; the risk
is the next person to change the rules changing one side, which is how the spec's
"*additional* filter criteria" becomes two dialects and a per-element filter
quietly starts replacing a saved view's instead of narrowing it.

`ListViewBlock` now contributes only what is genuinely its own — the names of the
keys `ListView` reads:

```ts
const LIST_VIEW_DATA_SOURCE: ElementDataSourceMapping = {
  columns: true, filter: true, sort: true,
  limit: 'pagination.pageSize', viewType: true,
};
```

and the ~45-line `useMemo` mapping block is deleted, along with the block's
hand-rolled error and loading panels (the shared
`ElementDataSourceErrorPanel` / `ElementDataSourceLoadingPanel` render with the
`list-view` testId prefix, so `list-view-datasource-error` and
`list-view-resolving-view` are unchanged down to the byte, and the error heading
is passed through as `errorTitle`).

**No behaviour changes in either direction**, and that is the acceptance
criterion rather than a hoped-for outcome: objectstack#5576's entire suite passes
untouched, with no assertion edited — had any single case needed adapting, the
two implementations would have been proven to disagree, which is a defect to
re-grade rather than a refactor detail to absorb. New pins cover the mapping
table key by key at the block/gate seam, plus the shared loading panel, which
neither implementation had ever asserted.
