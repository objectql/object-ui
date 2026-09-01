---
'@object-ui/plugin-grid': patch
---

Fix: a `dependsOn` lookup column is no longer permanently uneditable in an
editable `ObjectGrid`.

`LookupField` resolves the record it gates on as
`dependentValues ?? ctx.formValues ?? ctx.data ?? {}`, and the grid's inline
cell editor supplied **none** of the three — `renderCellEditor` rendered
`FieldEditWidget` with `field` / `value` / `onChange` only, `SchemaRendererContext`
has no `formValues`, and the grid sets no `ctx.data` for a row. The resolved
record was therefore `{}` for every row, so a column declaring `dependsOn`
rendered a disabled trigger reading "Select region first" **even when the row
carried the parent value**. The field could never be filled and nothing said
why.

PR #2216 closed #2215 in two halves: the form renderer injects its live watched
record as `dependentValues`, and every picker takes the `dependsOn` chain as a
hard `baseFilter`. The second half is host-independent and was already live on
the grid path — which is why the gate fired at all. The first half is per-host
and the grid never got it. `renderCellEditor` now passes
`dependentValues={ctx.row}`, supplying that missing input; no cascade is
re-implemented.

⚠️ Interim, and deliberately labelled as such in the code (#7165): `ctx.row` is
the **saved** record, so a parent edited but not yet saved in the same row does
not re-scope the child — it stays scoped by the persisted value. Matching the
form's live-record semantics needs a new member on `renderCellEditor`'s
published context type and is tracked as #7188.
