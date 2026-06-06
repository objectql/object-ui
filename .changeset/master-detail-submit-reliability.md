---
"@object-ui/plugin-form": patch
"@object-ui/fields": patch
---

fix(master-detail): reliable submit + stable e2e hooks

Fixes the "click Create, nothing happens" report, surfaced by a new live browser
e2e harness that drives the form with real input.

- **MasterDetailForm `handleSave`** now triggers the button-less parent form's
  submit from a deferred macrotask and re-queries the live `<form>` inside it.
  Calling `requestSubmit()` synchronously inside the click handler (right after
  the `setSaving` state update) intermittently dropped the nested submit event,
  so react-hook-form's `onSubmit` never ran and the click appeared to do nothing
  — only the occasional click got through. Deferring makes it fire every time.

- **Stable `data-testid`s** so automation/e2e can drive the widgets
  deterministically (Radix Select + react-hook-form cannot be driven by
  synthetic DOM events): `select-trigger-{field}` / `select-option-{value}`
  (SelectField), `lookup-trigger-{field}` (LookupField), `line-items-add`
  (GridField), `md-form-submit` / `md-form-cancel` (MasterDetailForm).
