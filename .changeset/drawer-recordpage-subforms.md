---
"@object-ui/plugin-form": patch
"@object-ui/app-shell": patch
---

feat(form): subforms in DrawerForm + full-page record form (Tier 0 everywhere)

Completes config-driven master-detail across all standard create/edit entry
points (after the modal in the previous change):

- `DrawerForm` now hosts `MasterDetailForm` inside the drawer when the schema
  declares `subforms` (its own Save bar; closes + refreshes on success).
- `RecordFormPage` (full-page New/Edit) sources `subforms` from the object's
  form view, so the full-page form renders inline child collections too.
- `ObjectForm`'s subforms shortcut now defers to the drawer/modal variants for
  those formTypes (so they keep their envelope), and only renders the
  master-detail form directly for inline/simple forms.

Declaring `formViews.default.subforms: [{ childObject }]` now yields a
master-detail experience in the modal, drawer, AND full-page form — no bespoke
page anywhere.
