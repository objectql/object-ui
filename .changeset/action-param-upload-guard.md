---
"@object-ui/fields": patch
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(app-shell): block ActionParamDialog submit while a file/image param is uploading; map spec `autonumber` (ADR-0059 follow-ups)

Two follow-ups to the shared-field-widget param rendering (ADR-0059):

- **Upload-in-progress guard.** A `file`/`image` param's value only becomes its
  fileId once the presigned upload settles, so confirming mid-upload sent an
  empty/stale value. `FileField`/`ImageField` now surface their upload state via
  an optional `onUploadingChange` prop (shared `useUploadingSignal` hook,
  ignored by other widgets); `ActionParamDialog` wires it for `file`/`image`
  params and disables Confirm (label → "Uploading…", new `actionDialog.uploading`
  i18n key across all locales) plus blocks submit while any upload is in flight.
- **`autonumber` spelling.** `mapFieldTypeToFormType` now maps the spec
  `FieldType` spelling `autonumber` (in addition to the widget-map key
  `auto_number`) to the AutoNumber widget, so a spec-typed `autonumber`
  field/param no longer falls through to the plain text input — fixes the object
  form path as well as action params.
