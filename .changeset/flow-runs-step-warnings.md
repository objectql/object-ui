---
"@object-ui/app-shell": patch
---

feat(app-shell): surface step warnings in the Flow Runs panel (#3407)

The automation engine now attaches advisory `warnings[]` to a step whose write
was legally stripped by the data layer — an `update_record`/`create_record`
targeting a `readonly` / `readonlyWhen` field. The step still reports
`success` (the strip is legitimate semantics), so the run trace previously
looked like a clean 3ms success while the intended write never landed; the
only signal lived in the server WARN log.

`FlowRunsPanel` now reads `step.warnings` and renders each one amber beneath
its step — with a ⚠ marker on the step row — **without** recoloring the
status. The dropped-write signal that #3407/#3413 plumbed from the data layer
into the run's step log now reaches the Studio, closing the observability loop
the author actually looks at.
