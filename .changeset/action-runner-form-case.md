---
"@object-ui/core": patch
---

fix(actions): handle `type: 'form'` in ActionRunner

A `form` action had no `case` in `ActionRunner`'s execution switch, so it fell
through to `executeActionSchema` and silently no-opped — clicking a Log-Time /
"open form" action did nothing. Add `executeForm`, which opens the FormView as a
routed page (`/forms/:name`, per the action spec) via the navigation handler,
forwarding the current record id as `?recordId=` for hosts that support it.
Covered by ActionRunner unit tests.
