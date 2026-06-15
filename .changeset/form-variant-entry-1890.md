---
"@object-ui/app-shell": patch
---

fix(form): honour the form view layout in the full-page record form

`RecordFormPage` hard-coded `formType: 'simple'`, so a record's declared form
view layout (`tabbed` / `wizard` / `split`) was ignored on the full-page
create/edit route — `ObjectForm` already renders every variant, the entry point
just never passed it through. It now reads the object's `form` / `formViews.default`
`type` + `sections` and forwards them (plus variant props: defaultTab, tabPosition,
allowSkip, showStepIndicator, split*). Page-level layouts only — `drawer`/`modal`
are presentation/open-modes, not record-page layouts, so they fall back to `simple`.

Refs objectstack-ai/framework#1890
