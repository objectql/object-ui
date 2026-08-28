---
'@object-ui/plugin-dashboard': minor
---

Dashboard flat `table` widget: render the server's grand total as a `tfoot` row (objectui#5846).

The flat branch now requests the `[]` marginal grouping — the same server-side
totals machinery the cross-tab has used since framework#1753 — and renders the
answer under the console's existing `dashboard.total` label. Totals are computed
by the server with each measure's TRUE aggregate (a `sum` sums, an `avg`/`min`/
`max` reports the whole-set aggregate); nothing is recombined client-side. The
row lives in `tfoot`, so it is exempt from sorting, renders below the `—` null
bucket, and never joins the drillable rows.

No footer is rendered when the executor answers no `[]` grouping, and none is
requested for a table truncated by `options.limit`, whose visible rows a
whole-set total could not be reconciled against.
