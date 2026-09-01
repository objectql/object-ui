---
'@object-ui/components': minor
'@object-ui/plugin-list': patch
---

`DataEmptyState` now declares `role="status"` by default, so an empty result is
distinguishable from a failed one on every surface that renders it
(objectui#7132).

This is the convergence half of the two rulings that landed as objectui#7063 and
objectui#7064, both resting on objectstack#13848: uniform behaviour belongs to
the platform, and per-surface compensation is the per-app tax being ruled
against. Those two fixed their own surfaces deliberately and locally; this card
measured whether the shared primitive should carry the property. It did not.

**Measured, not assumed.** All the surfaces were rendered and their empty boxes
read directly:

| surface | `role` before |
|---|---|
| `DataEmptyState` bare default | *none* |
| `plugin-list` empty list | *none* |
| `plugin-list` load-error panel | *none* |
| `plugin-detail` activity timelines | *none* |
| `ui:empty` schema renderer | *none* |
| `plugin-dashboard` `WidgetEmptyState` (#7063) | `status`, typed at the call site |
| `plugin-kanban` empty board | `status`, typed at the call site |

The sibling states in the same file had always declared themselves —
`DataLoadingState` is `role="status"`, `DataErrorState` is `role="alert"` — and
the empty state alone declared nothing. So the surfaces were not legitimately
differing: the ones that wanted the property had each hand-typed the same line,
and the ones that had not yet done so were silently missing it. That is one
platform default, copied by hand, at package level.

**It is a default, not a fixed attribute** — `role` is spread from props, so a
call site keeps the last word. That is what makes this inert for the two ruled
surfaces: both already pass `role="status"` explicitly and receive the identical
attribute with or without it. Neither surface's behaviour changes.

**One real defect fell out of the measurement.** `plugin-list` renders its load
FAILURE through `DataEmptyState`, borrowing it for layout — so a 403 saying "You
don't have access" and a young object saying "Nothing here yet" were the same
node shape, with no role on either. That panel now declares `role="alert"`,
which both fixes the pre-existing indistinguishability and stops the new default
from announcing an outage as a routine status.

Metric/KPI widgets are untouched: their carve-out (`rows.length === 0 &&
!isMetric`) gates whether an empty state is rendered *at all*, upstream of this
component, so a KPI still reads `0` rather than "no data".
