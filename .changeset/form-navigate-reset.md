---
"@object-ui/plugin-form": patch
"@object-ui/types": patch
---

feat(forms): declarative `navigateOnSuccess` + `resetOnSuccess` on object-form

Rounds out declarative success behavior for metadata-only forms (which can't
pass an `onSuccess` function), complementing `successMessage`:

- **`navigateOnSuccess`** — after a successful create/update, navigate here.
  Supports `{id}`/`{recordId}` interpolation from the saved record and is
  same-origin-guarded; takes precedence over the toast (landing on the record
  is the confirmation).
- **`resetOnSuccess`** — after a successful create, reset the form for another
  entry (the wizard returns to a cleared step 1). Ignored when navigating.

Wired in both ObjectForm and WizardForm via a small shared `successBehavior`
helper (kept dependency-free to avoid an EmbeddableForm import cycle).
