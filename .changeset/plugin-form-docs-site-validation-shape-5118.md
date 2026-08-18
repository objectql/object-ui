---
'@object-ui/plugin-form': patch
---

The plugin-form documentation-site page now teaches the `validation` shape the
form renderer actually reads, so a copied example validates instead of only
looking as though it does.

`content/docs/plugins/plugin-form.mdx` carried the same two defects
`packages/plugin-form/README.md` did before it was rewritten (objectui#5075 /
objectui#5118): the README half was fixed and the documentation-site mirror was
not touched.

`### Form Field` redeclared a local `interface FormField` whose `validation` was
`ValidationRule[]`. No `ValidationRule` type exists in this repository under any
spelling, and `validation` is not an array — it is `FieldValidationRules`
(`packages/types/src/form.ts`), an object keyed by rule name. The block also
listed `defaultValue` and `className`, neither of which is a declared member of
`FormField`, and marked `type` and `label` required when `name` is the only
required key of the 23. The section no longer declares a local interface at all
— a hand-written `interface` in a documentation snippet compiles nowhere, which
is how it drifted this far — and references the declared keys instead, each one
measured against the renderer's read points.

`### Form with Validation` authored the array to match, and that spelling fails
silently rather than loudly. The only reader of the key spreads it into the rule
object handed to react-hook-form (`const rules: any = { ...validation }`,
`packages/components/src/renderers/form/form.tsx:1652`); spreading an array
produces numeric keys, react-hook-form recognises none of them, and every rule
is dropped without an error. Measured against the real renderer: the old snippet
submits a two-character username under `minLength: 3` with no message shown,
while the rewritten one blocks it. The example is now annotated `FormSchema`, so
the array spelling is a compile error (TS2559) rather than a runtime surprise,
and a JSON variant is given alongside it for metadata authoring.

Three facts a reader could previously only discover by experiment are now
stated: `validation.required` supplies the required *message* while `required` /
`requiredWhen` on the field decide whether it is required; there is no `email`
rule name, an email check is a `pattern`; and a hand-authored `pattern` has to
carry a RegExp, because react-hook-form applies a pattern only when its value is
`instanceof RegExp` — it is the object-metadata path (`buildValidationRules`)
that compiles a declared string into one.

The two `DOC_TYPE_EXEMPTIONS` entries this page held in
`scripts/check-doc-component-types.mjs` are deleted with it. They exempted
`minLength` / `maxLength` as "ValidationRule discriminants under a field's
`validation[]`" — a reason whose every clause was the fiction being removed —
and without them the gate now fails if the array spelling returns.
