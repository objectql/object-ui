---
'@object-ui/plugin-dashboard': minor
---

Dashboard `table` widget (dataset-backed, flat grouped table) — four rendering
fixes so it reads as a table rather than a raw dump (objectui#5827):

- **Numeric columns right-align**, header and cells. `tabular-nums` was already
  applied to every cell and could not do its job while the digits were flushed
  left. A column qualifies when it is a MEASURE and every non-null value in it
  is a number — the declared column `type` cannot decide it, because the
  analytics executor stamps `type: 'number'` on every measure regardless of the
  aggregate, so a `min()`/`max()` over a text field would have been
  right-aligned on the strength of a label. Dimensions stay left-aligned even
  when their bucket keys are digits: a grouping axis is not a quantity.
- **Sortable headers.** Each header is a keyboard-reachable button that cycles
  ascending → descending → back to the dataset's own order, with the console's
  existing sort indicator and `aria-sort` on the `th`. Blanks sort last in
  BOTH directions. The sort is client-side over the rows already fetched — the
  widget issues one `queryDataset` call and paginates nothing, so no round trip
  is involved.
- **The empty-dimension bucket sorts last** in the default order instead of
  floating to the top. It keeps its `—` label; only its position moves.
- **Row hover feedback on every row**, not only on a drillable one. A drillable
  row keeps its stronger accent fill.

The CSV export now follows the order the table is showing, which is the same
"the CSV is the table's data" convention its cell text already followed.
Drill-through is unaffected: rows are reordered as `(row, incoming index)`
pairs, so a drill still resolves through the server's parallel raw-value
sidecar.

Unchanged: the cross-tab (a `pivot` with ≥2 dimensions) renderer, the KPI and
chart paths, and every non-dataset table in the console.
