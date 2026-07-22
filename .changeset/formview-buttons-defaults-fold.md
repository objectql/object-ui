---
"@object-ui/plugin-form": patch
"@object-ui/plugin-view": patch
"@object-ui/app-shell": patch
"@object-ui/types": patch
---

feat(form): consume spec-aligned FormView buttons/defaults in ObjectForm

The authored `@objectstack/spec` FormViewSchema carries structured
`buttons.{submit,cancel,reset}.{show,label}` and `defaults`, but the form
renderer only read the flat renderer-invented `showSubmit`/`submitText`/
`showCancel`/`cancelText`/`showReset`/`initialValues`. That left the two spec
keys parsed-but-inert (ADR-0078) and stuck at `experimental` in the spec
liveness ledger.

`ObjectForm` now folds the structured shape down onto those flat props inside
its existing normalization pass, so every entry path (ObjectView
drawer/modal/page, RecordFormPage) honors it. An explicitly-set flat key still
wins, so metadata authored against the deprecated flat keys is unchanged.
`ObjectView` and `RecordFormPage` forward `buttons`/`defaults` from the spec
form view. `ObjectFormSchema` gains the optional `buttons`/`defaults` fields.

Refs objectstack-ai/objectstack#1894, objectstack-ai/objectstack#2998.
