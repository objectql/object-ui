---
"@object-ui/plugin-grid": patch
---

feat(grid): inline select editor only offers valid state-machine transitions

When a field is governed by a `state_machine` validation, the inline cell
editor now filters its dropdown to the values reachable from the current state
(the current value plus its declared transitions) — so you can't stage an edit
the server is bound to reject. Example: a task already `Done` only offers
`Done` and `In Progress`, not `In Review`.

This reads the same `validations` metadata the server enforces (already served
on the object schema), and falls back to showing all options when the field has
no state machine or its current state is undeclared (mirroring the validation
engine's lenient allow). Complements the save-failure surfacing — prevent the
invalid edit at the source, and still report it if one slips through.
