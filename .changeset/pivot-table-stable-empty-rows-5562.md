---
'@object-ui/plugin-dashboard': patch
---

`PivotTable` no longer re-runs its cross-tabulation memo on every render when it
has no rows (objectui#5562).

The component spelled the empty array twice — as the destructuring default for
`schema.data` and as the `Array.isArray` fallback that keeps a provider-config
object out of iteration — so a schema declaring no `data` key, or one whose
`data` is a provider config rather than rows, produced a fresh array identity on
every render. That value is the first entry of the memo's dependency list, so
the memo rebuilt its two ordered key sets, its `bucket[row][col]` map, the
aggregated matrix and the row/column/grand totals on every render, over nothing.
Both spellings now resolve to one module-scope frozen empty, so "no rows" is a
stable value and the memo holds.

Wasted work only: the churn feeds a memo rather than a `setState`, and
`PivotTable` holds no prop-to-state sync, so nothing rendered wrong and no
render loop was possible. The identical fix landed for `data-table` in
objectui#4618 and for `ObjectPivotTable` in objectui#4629; this closes the
direct-use path those two did not cover, where `DashboardRenderer` and
`DashboardGridLayout` construct pivot schemas without `ObjectPivotTable` in the
chain.
