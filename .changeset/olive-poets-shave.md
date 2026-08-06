---
'@object-ui/plugin-report': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/core': patch
---

Fix matrix report cells showing another bucket's numbers when dimension values run together.

The cross-tab in `DatasetReportRenderer` built its bucket ids by joining dimension values with the EMPTY string, so adjacent values had no boundary at all: `"x"` + `"yz"` and `"xy"` + `"z"` were the same bucket on both axes, and the later row silently overwrote the earlier one. Its cell key then joined the two bucket ids with a plain space, while dimension values contain spaces constantly ("New York", "In Progress"), so `"New"` × `"York Q1"` and `"New York"` × `"Q1"` also met in one key. A merged bucket showed a different row's measure, the overwritten row's value was unreachable, the per-row and per-column subtotals matched the wrong header, and drill-through followed the same wrong index into another record's list — none of it with an error.

Bucket ids and cell keys are now encoded with `JSON.stringify`, which carries the boundary in its own quoting rather than in a character the data is assumed never to contain. All four lookups in the renderer (row headers, column headers, row subtotals, column subtotals) share the one encoder, so they agree by construction.

The encoders moved to `@object-ui/core` as `pivotBucketId` / `pivotCellKey` and are now shared with the dashboard `DatasetWidget`, which carried the same defect and fixed it separately: two packages each hand-rolling the same key is why one fix left the other broken. The dashboard keeps its existing exports and behaviour.
