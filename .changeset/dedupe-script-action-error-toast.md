---
"@object-ui/app-shell": patch
---

fix(app-shell): stop double-toasting failed script/modal action errors

`serverActionHandler` toasted the action error itself **and** returned
`{ success: false, error }`, which `ActionRunner.handlePostExecution` also
surfaces as a toast — so a failed script action (e.g. a validation throw)
showed two identical red toasts.

`apiHandler` and `flowHandler` already only return the error and let the
runner own the toast; `serverActionHandler` now does the same, so a failed
action toasts exactly once.
