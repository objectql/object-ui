---
"@object-ui/app-shell": minor
"@object-ui/plugin-form": minor
"@object-ui/fields": minor
"@object-ui/data-objectstack": minor
---

feat(app-shell): render full object forms (incl. master-detail) in screen-flow wizard steps

`FlowRunner` now renders an `object-form` screen step: when the paused screen
carries `kind: 'object-form'`, it mounts the real `<ObjectForm>` for the named
object (auto-routing to `MasterDetailForm` for inline child collections),
prefilled from the step's `defaults`. The form persists itself (atomic
master-detail batch), then resumes the run with the saved record id bound to the
step's `idVariable`. `dataSource`/`objects` are threaded through all three
`FlowRunner` mount points.

Also fixes three pre-existing bugs this surfaced (each affects normal forms too):

- **plugin-form**: `ObjectForm` now forwards `initialValues`/`initialData` when
  routing to `MasterDetailForm`, so prefilled header values are no longer
  dropped on master-detail create forms.
- **fields**: `PercentField` treated values as `0–1` fractions (`value × 100`),
  so a `0–100` field (e.g. `probability` default `50`) rendered as `5000%` —
  exceeding `max=100`, which makes HTML5 constraint validation mark the field
  `:invalid` and silently block the whole form's submit. It now treats a field
  declaring `max > 1` as the `0–100` whole-number convention, matching the
  read-side formatter.
- **data-objectstack**: `ObjectStackAdapter.batchTransaction` now sends
  `credentials: 'include'`, so master-detail batch saves authenticate under the
  console's cookie session (previously every batch save 401'd).
