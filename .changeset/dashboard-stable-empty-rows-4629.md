---
'@object-ui/plugin-dashboard': patch
---

`ObjectDataTable` and `ObjectPivotTable` now use a module-scope frozen empty for
"no rows yet" instead of a fresh array literal per render (objectui#4629).

Both spelled the resolved row list as `Array.isArray(rawData) ? rawData : []`, so
whenever `rawData` was a truthy non-array — a provider-config `data`, or a `bind`
path that resolves to an object — the fallback produced a NEW array identity on
every render. In `ObjectDataTable` that value keys the `derivedColumns` memo, so
every column was re-derived (`buildFieldMeta`, a fresh `cell` closure, the
`isSystemField` pass, the `fieldLabel` lookups) and then discarded by the
`finalData.length === 0` early return. In `ObjectPivotTable` the value is handed
straight to `PivotTable`, where it keys the cross-tabulation memo, so the pivot
rebuilt its row/column sets, bucket map and totals on every render over no rows
at all.

Nothing rendered wrong before or after; this is wasted work in the empty window,
plus the live `react-hooks/exhaustive-deps` warning the conditional raised. It is
the same module-scope frozen empty `data-table.tsx` adopted for its own
`EMPTY_ROWS` (objectui#4618), applied to the `provider: 'object'` siblings.
