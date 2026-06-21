---
"@object-ui/plugin-form": patch
"@object-ui/types": patch
---

feat(forms): declarative `successMessage` on object-form

Metadata-only forms (a wizard/object-form authored as JSON) cannot pass an
`onSuccess` function, so the post-create/update feedback was a fixed
"Created"/"Saved" toast. `ObjectFormSchema` now accepts `successMessage`, which
ObjectForm and WizardForm use for the default success toast when no `onSuccess`
handler is supplied. Falls back to "Created"/"Saved".
