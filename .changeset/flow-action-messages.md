---
"@object-ui/core": minor
"@object-ui/app-shell": minor
---

feat: action/flow completion messaging

- **core**: `ActionResult.silent` — a handler sets it when the action only
  HANDED OFF to a follow-up UI (rather than completing), so `ActionRunner`
  skips the automatic success toast. Fixes the misleading "Action completed
  successfully" toast that fired the moment a `flow` action opened its wizard.
- **app-shell**: both flow handlers now return `silent: true` when the flow
  pauses at a screen (the wizard only opened — it hasn't completed). `FlowRunner`
  renders the flow's declared `successMessage` / `errorMessage` (from the
  terminal `AutomationResult`) instead of a generic "Done" / the raw error.
