---
'@object-ui/types': minor
---

`disabled` accepts a predicate string — `boolean | string`, the `BaseSchema` union — on
the 18 concrete schemas that used to narrow it back to `boolean` (objectui#7087,
maintainer ruling 2026-09-01: option 1, scoped to `disabled`).

`visible` and `disabled` are twins: objectui#4581 widened both on `BaseSchema` on the same
evidence — `SchemaRenderer` evaluates both through `evaluator.evaluateCondition` rather
than reading either as a boolean. After that widening, 0 of the 124 `extends BaseSchema`
interfaces redeclared `visible`, while 18 still carried a pre-widening
`disabled?: boolean` of their own, with matching `z.boolean()` mirrors. So
`disabled: "${data.status === 'locked'}"` — the capability the renderer implements and
the base type advertises — was a type error and a zod refusal on `ButtonSchema`,
`InputSchema`, `TextareaSchema`, `SelectSchema`, `CheckboxSchema`, `RadioGroupSchema`,
`SwitchSchema`, `ToggleSchema`, `SliderSchema`, `FileUploadSchema`, `DatePickerSchema`,
`CalendarSchema`, `InputOTPSchema`, `FormSchema`, `ComboboxSchema`, `ActionSchema`,
`CollapsibleSchema` and `ToggleGroupSchema`.

Those 18 redeclarations are removed, on both faces. The interfaces inherit
`BaseSchema.disabled` the way they always inherited `visible`; the zod mirrors inherit
`base.zod.ts`'s `z.union([z.boolean(), z.string()])` through `.extend()`'s merged
`.shape`, so there is no second spelling of the union to drift from — the route
`ChatbotSchema` took in objectui#6169.

**Additive for authors**: a predicate string is now accepted where it was refused; every
boolean that parsed before parses unchanged, and a number is still refused at path
`disabled`. Runtime behaviour does not change — the renderer already evaluated both twins.

**Out of scope, per the ruling**: `label` (29 narrowings) and `description` (32) carry
`string | I18nLabel` i18n semantics and wait for their own ruling; the independent
`disabled?: boolean` declarations on shapes that do not extend `BaseSchema`
(`SelectOption`, `RadioOption`, `FormField`, `ComboboxOption`, `AccordionItem`,
`ToggleGroupItem`, and the rest of that family) are not narrowings and are untouched.
