---
"@object-ui/core": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-report": patch
"@object-ui/app-shell": patch
---

Honor the server's declared percent scale, so a ratio of exactly 1 renders as 100.0% (#3136)

A dataset measure declared `format: '0.0%'` rendered every ratio below 1
correctly and got the single most consequential one wrong: a rate of exactly
`1` printed as **`1.0%`**. On an SLA / pass-rate dashboard that turns
"everything met the SLA" into "1% met the SLA", on both surfaces the issue
names — the KPI card and the dataset-bound table (they share `formatMeasure`).

The cause was never a bad multiplier; it was a missing fact. `formatMeasure`
scaled by magnitude — `percentDisplayValue` multiplies by 100 only strictly
inside `(-1, 1)` — because the column arrived with a `%` format string and
nothing saying what scale its numbers were on. That guess is undecidable at
exactly 1, which is both a full-compliance ratio ("100%") and one percentage
point ("1%"), and it resolved to the reading almost nobody means.

The server now answers the question instead (framework: `percentScaleOf` +
`AnalyticsResult.fields[].percentScale`, the sibling of the ADR-0053 currency
chain): a `derived: { op: 'ratio' }` measure is a `fraction` by definition, and
a measure over a `percent` field inherits that field's scale. `formatMeasure`
takes the declared scale as a fourth argument and, when present, scales by it —
`fraction` ×100, `whole` verbatim — instead of inspecting the value. Every
dataset-bound call site passes the column's `percentScale`: the dashboard
metric/table/pivot cells, the report renderer's cells, totals and KPI, and the
dataset preview.

`percentDisplayValue` is untouched and still the fallback for a column that
arrives without the annotation (an older server, or a non-dataset percent cell
in a list view), so nothing that renders correctly today changes.
