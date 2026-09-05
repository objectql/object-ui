---
'@object-ui/components': minor
'@object-ui/plugin-grid': patch
'@object-ui/app-shell': patch
---

One authority per exported type name, batch 3 of objectui#6349: `ComboboxOption`,
`NamedActionDef`, `OrgTranslate`.

**`@object-ui/components` — `ComboboxOption` now IS `@object-ui/types`' declaration.**
The component declared its own `{ value, label }`, a strict subset of the
`ComboboxOption` that `@object-ui/types` declares for `ComboboxSchema.options` and
mirrors in `form.zod.ts` (`{ value, label, disabled? }`). The component now re-exports
the types declaration (through the `@object-ui/types/form` subpath — the root barrel
does not publish the name), so the name `ComboboxOption` exported from
`@object-ui/components` gains the optional `disabled?: boolean` member. Every value
that type-checked before still does — nothing narrows and no key changes type; the
one thing that moves is `keyof ComboboxOption`, so a consumer that EXHAUSTS the type
(a `Record` over its keys) will need the new key. Note that the `Combobox` component
itself does not read `option.disabled` — that member was already declared on the
`@object-ui/types` face and is now visible on this one too; it is recorded as a
separate finding, not changed here.

**`@object-ui/plugin-grid` / `@object-ui/app-shell` — internal, surface unchanged.**
`NamedActionDef` was declared identically in `resolveBulkActions.ts` and
`resolveLegacyRowActions.ts`; the latter is now the one authority and the former
re-exports it. `OrgTranslate` was declared identically in `orgErrorMessage.ts` and
`orgRoleLabel.ts`; the former is now the one authority and the latter re-exports it.
Neither name is on its package's public entry, and every deep-`dist` module still
exports the same name with the same shape.

`FilterBuilderCondition` / `FilterGroup` (the other two names this batch was sized
with) are deliberately NOT converged: their shapes disagree on `id`, `value` and on
`operator`, and the only dependency-legal re-point would retype `operator` — the
vocabulary objectui#7561 is asking a maintainer to rule on.
