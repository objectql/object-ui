---
'@object-ui/components': minor
---

One home for the `date` display convention in `data-table` (objectui#7620).

`data-table`'s fallback cell (`formatCellValue`) sniffs ISO strings and
formats them. Its date-only branch built its own `Intl.DateTimeFormat` bag —
`{ year: 'numeric', month: 'short', day: 'numeric' }` — while the shared
`formatDate` drops the year inside the CURRENT year on purpose (the year
rarely helps on an in-progress record and crowds the cell). So one table
rendered two faces for the same value depending on which path a cell took:
the `date` field cell showed `Jul 4` and the fallback cell showed
`Jul 4, 2026`. The branch now calls `formatDate` (default style).

**Visible change**: in every `data-table`, a current-year date-only value in a
column that renders through the fallback cell loses its year — `Jul 4, 2026`
becomes `Jul 4` in `en-US` — and now matches the `date` field cell beside it.
Past- and future-year dates are byte-identical (`Jul 4, 2024`), which is why
the split was easy to miss: the two faces only ever diverged on the dates
users look at most. The datetime branch, the non-date passthrough and every
cell with its own renderer are untouched.

A column that genuinely wants the year on every row is an explicit `format`
style honoured by both paths, not a second option bag — the objectui#7443 /
objectui#4576 lesson, one type over.
