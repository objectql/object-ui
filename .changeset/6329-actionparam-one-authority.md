---
'@object-ui/app-shell': patch
---

`ActionParam` has one authority again (objectui#6329). The name was declared three times,
not twice as the card counted: `@object-ui/types` publishes it — derived from the spec's
`ActionParamSchema` input, with its own parity suite — and `ActionDefaultInspector.tsx` and
`ActionPreview.tsx` each carried a module-local `interface` of the same name. app-shell
already read the published one elsewhere (`utils/resolveActionParams.test.ts`), so both
locals were shadows. They are deleted, not reconciled against each other, under the
2026-08-25 family ruling 甲A1.

Neither shadow needed a member the published type lacks, so nothing was added to the
published surface. What the shadows got wrong was the DECLARATION, in the direction that
lets wrong metadata compile:

- The inspector's copy carried `[k: string]: unknown`. An index signature admits every key
  at type `unknown`, so a commit of a key `ActionParamSchema` rejects by name — `.strict()`,
  and `referenceTo` is listed in its alias map — type-checked here and failed on save. It
  also made the two copies look compatible when they were describing different authoring
  surfaces: `options` / `helpText` / `defaultValue` were declared outright on one side and
  swallowed as `unknown` on the other.
- The preview's copy declared `label?: string | { en?: string }`, admitting the `en` tag and
  no other, while its own `localize` helper has always read `Object.values(o)[0]`. An inline
  locale map keyed `fr-FR` rendered correctly and failed `tsc`. The published `I18nLabel`
  admits both authorized forms, so the type now matches what the code already did — this
  widens the declaration, not the runtime's acceptance.

Two behaviour-visible consequences, both of them the local `type?: string` being withdrawn
in favour of the published `ResolvableParamFieldType` (the spec's 49-member `FieldType` plus
objectui's three declared param aliases):

- `ActionPreview.renderFieldMock` no longer branches on `long_text` or `integer`. Neither is
  in that vocabulary — `long_text` belongs to the console form-builder dialect and `integer`
  to JSON Schema — so a param spelled either way is a parse rejection on the server and
  could never have reached the preview. The two comparisons compiled only because the local
  copy typed `type` as `string`.
- The inspector's param-type dropdown narrows its commit through the runtime witnesses
  `@object-ui/types` exports (`ACTION_PARAM_FIELD_TYPES` + `OBJECTUI_LOCAL_PARAM_FIELD_TYPES`)
  rather than writing the raw DOM string. An unrecognised spelling clears the key instead of
  being written into metadata the server would refuse; the eight offered spellings are
  unaffected, and are now checked against the vocabulary at compile time.
