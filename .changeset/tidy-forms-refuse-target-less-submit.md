---
'@object-ui/plugin-form': patch
---

Variant forms refuse a submit that has nowhere to go, instead of reporting success

`TabbedForm`, `WizardForm`, `SplitForm`, `DrawerForm` and `ModalForm` each opened
`handleSubmit` with `if (!dataSource) { await schema.onSuccess?.(data); return data; }`
— a success signal emitted without consulting a declared `submitHandler` and without
persisting anything. Through `MasterDetailForm`, whose parent schema declares both
`submitHandler: submitViaBatch` and `onSuccess: handleSaved`, that produced a success
toast and, in create mode, a form reset clearing values nobody wrote.

All five now answer the question the same way `SimpleObjectForm` and the `object-form`
element gate already do. A form has a submit target when it has a `dataSource` or a
declared `submitHandler`; with neither, the one legitimate shape is inline fields —
a non-empty `customFields`, or `sections` whose fields are all inline runtime
`FormField` objects — whose `onSuccess` is the write. Anything else throws
`DataSource is required for form submission (inline mode not configured)`, which
reaches `schema.onError` and is rethrown. A declared `submitHandler` is consulted
first, so a host that owns the write is never bypassed for want of an adapter it
never needed.
