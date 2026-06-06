---
"@object-ui/plugin-form": minor
"@object-ui/app-shell": minor
---

feat(form): standard New/Edit modal renders form-view subforms (Tier 0)

The console's standard create/edit record modal now renders inline child
collections when the object's form view declares `subforms` — master-detail
entry with **no bespoke page**, persisted as one atomic transaction.

- `ModalForm` (and the create/edit modal in app-shell `AppContent`) detects
  `subforms` and renders `MasterDetailForm` inside the dialog (it owns its Save
  bar; the modal footer is suppressed); on success the modal closes + refreshes.
- `AppContent` sources `subforms` from the object's default form view
  (`form.subforms` / `formViews.default.subforms`).
- `ModalFormSchema` gains `subforms`.

With this, declaring `formViews.default.subforms: [{ childObject }]` is enough
to make an object's standard New/Edit screen a master-detail form — completing
the config-driven master-detail story (Tier 0 → derive everything from the
relationship + child metadata).
