---
'@object-ui/plugin-form': patch
---

Fix master-detail record create: stop double success toast + localize the Cancel button.

Objects with inline subforms (master-detail, e.g. a Lead with product line items)
render `MasterDetailForm` inside `ModalForm`/`DrawerForm` instead of the plain
footer, which exposed two mismatches with the host contract:

- **Double success toast.** Flat `ObjectForm` delegates confirmation to the host
  when an `onSuccess` is supplied (skips its own default toast), but
  `MasterDetailForm.handleSaved` ALWAYS toasted `Created`/`Saved` AND ran
  `onSuccess`. In the console the host's `onSuccess` chains into the `crud_success`
  handler, which toasts a localized message — so create fired both `Created` and
  e.g. `线索创建成功`. `handleSaved` now only toasts as a fallback when no host
  `onSuccess` is provided, matching the `ObjectForm` contract; saves without a host
  handler stay non-silent.

- **Hardcoded English `Cancel`.** The master-detail action bar wrote `Cancel` as a
  literal and accepted no `cancelText`, so the button stayed English while the
  submit button was localized (`submitText` was already forwarded).
  `MasterDetailForm` now takes `cancelText`, and `ModalForm`/`DrawerForm`/`ObjectForm`
  forward the host's localized label down the subforms branch.

Adds regression tests: create with a host `onSuccess` fires no built-in toast (no
double-confirm), and the Cancel button renders the host-supplied `cancelText`.
