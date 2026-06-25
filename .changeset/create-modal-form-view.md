---
"@object-ui/app-shell": patch
---

fix(form): create/edit record modal now honors the object's default form view

The "New <object>" modal (and the modal edit form) rendered every field from
the raw object schema, in schema order — ignoring the curated sections + field
selection/order defined in the object's default FORM VIEW. Customizing the form
view (section grouping, field selection/order) had no effect on the create
modal; only `tabbed` views were partially honored, while a `simple` view with
curated sections was dropped entirely.

New `resolveFormViewLayout(objectDef)` helper resolves the default form view
(`objectDef.form ?? formViews.default`) into the modal's layout props (curated
`sections`, `contentLayout: 'tabbed'`, and master-detail `subforms`), mirroring
the full-screen `RecordFormPage`. It is wired into:

- the global New/Edit `ModalForm` in `AppContent` (replacing the tabbed-only
  inline logic so `simple` sectioned views are honored too), and
- `useActionModal` (action-opened forms), which previously passed no
  `fields`/`sections` and so fell back to the whole object schema.

When the object declares no form view — or one without sections — the modal
keeps its prior flat-field behavior. Frontend-only.
