---
'@object-ui/plugin-form': patch
---

Docs only: `packages/plugin-form/README.md`'s Schema API and Examples now spell
the keys the form renderers actually read (objectui#5075). Three connected
drifts, judged against the build product's `dist/index.d.ts` under `strict`:

- **`validation` was written as an ARRAY** of `{ type, value, message }` entries
  in three places. The real key is `FormField.validation?: FieldValidationRules`
  — an OBJECT keyed by rule name (`required`, `minLength`, `maxLength`, `min`,
  `max`, `pattern`, `validate`). The array form is worse than a type error,
  because its runtime failure is SILENT: the only reader spreads the value into
  the rule object handed to react-hook-form (`const rules: any = { ...validation }`,
  `packages/components/src/renderers/form/form.tsx:1652`), and spreading an array
  into an object literal yields numeric keys (`{ '0': …, '1': … }`).
  react-hook-form's field validator reads exactly `required`, `maxLength`,
  `minLength`, `min`, `max`, `pattern`, `validate`, `valueAsNumber` off its
  descriptor, so every documented rule was dropped with nothing thrown — a form
  copied from this README looked validated while validating nothing. The rewrite
  also records two facts a reader could not have guessed: `validation.required`
  supplies the required MESSAGE only (presence is decided by the field's own
  `required` / `requiredWhen`), and a hand-authored `pattern.value` must be a
  RegExp, since react-hook-form only applies a pattern whose value
  `instanceof RegExp` and it is the object-metadata path (`buildValidationRules`)
  that compiles a declared string into one.

- **`type: 'multi-step-form'` is registered nowhere**, and `steps` is not a key
  on any form schema — so the whole "Multi-Step Form" example rendered the
  unknown-component placeholder, with the fields inside `steps` never read. The
  example is replaced by the two real entry points: an `object-form` with
  `formType: 'wizard'`, whose steps are its `sections` (this is what
  `ObjectForm` routes to `WizardForm`), and the exported `WizardForm` itself
  with inline section fields and no data source — the shape closest to what the
  old snippet was reaching for. No new schema type was registered to make the
  old spelling true.

- **The `FormField` reference block declared a local `interface FormField`**,
  which type-checks whatever it says because it is unrelated to the real type.
  Five of its rows were wrong (`type` and `label` are OPTIONAL; `validation` is
  the object above; `defaultValue` and `className` are not declared keys — the
  form-level `defaultValues` and `span` / `colSpan` / `fieldContainerClass` are),
  it named a `ValidationRule` type that exists nowhere in the repo, and it listed
  7 of the real 23 keys. The block is now a key table over the real declaration,
  with `FormSchema`'s own keys beside it, and both examples are annotated with
  their real types — the annotation is the point: `FormField` and `BaseSchema`
  both declare `[key: string]: any`, so an un-annotated `const schema = { … }`
  accepts any invented key and a nonexistent key is never a compile error.

No renderer behaviour changes, and no capability, export or type was added to
make an example true.
