---
'@object-ui/app-shell': minor
---

Add FlowRunner — render & resume interactive screen-flows

A `type: 'flow'` action whose run pauses at a `screen` node now opens a
`FlowRunner` modal that renders the screen's fields, submits the values to the
framework resume endpoint (`POST /api/v1/automation/{flow}/runs/{runId}/resume`),
and advances to the next screen or closes + refreshes on completion. Previously
such flows launched server-side but the screen was never rendered, so the input
was never collected.

- New `FlowRunner` component (fields → form → resume loop).
- `ObjectView` + `RecordDetailView` flow handlers detect a paused-screen launch
  response (`{ status:'paused', runId, screen }`) and open the runner; for
  list_item actions the row's id (`_rowRecord.id`) flows in as the flow's
  `recordId`.

Pairs with the framework screen-flow runtime (`@objectstack/service-automation`
+ `@objectstack/runtime`). Verified in-browser: showcase task row → "Reassign…"
→ form → submit → the task is reassigned.
