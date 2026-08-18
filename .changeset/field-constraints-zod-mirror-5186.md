---
'@object-ui/types': minor
---

Align `FieldConstraintsSchema` (the zod face of `FormFieldSchema.validation`) to the public TS contract `FieldValidationRules`. Behaviour change in `objectui validate`: `validation` written to the TS contract — `required: string | boolean`, `minLength`/`maxLength`/`min`/`max` as `{ value, message }` objects, `validate` function — is now accepted (it was rejected before), and the flat scalar dialect (`minLength: 3`, `pattern: '^[a-z]+$'`) that react-hook-form never runs is now rejected (it passed before, validating nothing — the objectui#5099 symptom on the zod face). `pattern.value` must be a compiled RegExp per the objectui#5099 ruling; JSON/YAML cannot express one, so a string `pattern.value` is rejected by name with guidance toward the metadata route (`FieldSchema.pattern`). No silent strip, no string-to-RegExp coercion.
