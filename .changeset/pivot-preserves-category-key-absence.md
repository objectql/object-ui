---
'@object-ui/core': patch
---

`buildChartSeries`' pivot branch preserves key ABSENCE, so a never-projected first dimension still reaches the framework#4033 placeholder.

`hasNoCategoryKey` (plugin-charts' `AdvancedChartImpl`) exists to catch one
shape: a dimension a dataset query GROUPED BY but never PROJECTED, so no row
carries the category key. Rather than draw an axis with no marks, the renderer
names the missing key. Its whole signal is `key in row`, asked of the rows it is
handed — which for a dataset-bound chart are `buildChartSeries`' output.

The pivot branch wrote `[xKey]` onto every bucket it created, so `key in row`
was unconditionally true downstream and the guard could not fire for a
2-dimension/1-measure chart no matter what the query returned. Every row
collapsed into one unnamed bucket drawing a blank tick — the exact silent shape
the placeholder was introduced to eliminate. The defence was dead precisely
where the defect it guards against lands. The single-dimension branch was never
affected: it passes rows through, so key-absent rows stay key-absent.

An emitted bucket now carries the axis key exactly when some row of it did.
That is `hasNoCategoryKey`'s own `rows.some(key in row)` lifted through the
pivot's aggregation, so the guard reads the same fact before and after.

The route rests on a measurement of how a dataset query actually reports an
unprojected dimension in a 2-dimension grouping: it OMITS the key. The ObjectQL
strategy writes a dimension key only when the engine returned that column, the
native-SQL strategy returns driver rows carrying only the selected columns, JSON
cannot transport `undefined`, and `ObjectStackAdapter.queryDataset` passes rows
through by reference. An explicit `null` means the opposite — the column WAS
projected and its value is null — and that case is untouched: it still renders
under the `(None)` bucket label (objectui#4466 / objectui#4497). Where one
bucket collects both (an absent value and a stored `null` share the `[null]`
identity), the bucket keeps its label and draws, because refusing there would
tell an author their query never projected a dimension that it did.

No change to any chart whose first dimension projected: ordinary, null-valued
and empty-string categories all emit byte-identical rows, key order included.
