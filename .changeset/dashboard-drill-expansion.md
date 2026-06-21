---
"@object-ui/types": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-charts": patch
---

feat(dashboard): expand drill-in — table/list row→record + scatter/treemap/sankey drill-through

Drill-in now covers the widgets that were missing it, and formalizes the two
interaction semantics mainstream BI/low-code platforms separate. `DrillDownConfig`
gains a `mode` discriminator: `'filter'` (drill-through: aggregate bucket → filtered
record list) and `'record'` (drill-to-record: a table/list row → that record's detail).

- Scatter, treemap and sankey charts now wire click → the existing filtered-record
  drill drawer (radar excluded — no single clickable category point). The
  Recharts-payload → drill-event mapping is extracted to pure, tested functions.
- Object-backed table/list widgets drill to the clicked record in a read-only detail
  drawer (Sheet/Dialog), on by default (`drillDown:{enabled:false}` opts out). Field
  labels and value formatting (incl. tenant-default currency) are shared with the
  table cells so a value reads identically in both. An author-supplied `onRowClick`
  still wins.
- The chart/KPI drill-through record lists now drill into a record too, completing the
  segment → list → record chain.
