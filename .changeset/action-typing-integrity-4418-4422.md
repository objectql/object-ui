---
'@object-ui/components': minor
---

The action renderers publish the modern `UIActionSchema`, and every `forwardRef` renderer's props parameter is annotated so its declared types survive

**Breaking semantics (declared `minor` per the repo's version-alignment rule — objectui#4403 precedent — never `major`).** Six exported declarations in `@object-ui/components` change the action type they name, from the `@deprecated` legacy `ActionSchema` (`crud.ts`) to `UIActionSchema` (`ui-action.ts`):

- `ActionBarSchema.actions`, `ActionBarSchema.systemActions`
- `ActionMenuSchema.actions`
- `ActionGroupSchema.actions`
- `ActionButtonProps.schema`, `ActionIconProps.schema`

The two types are not interchangeable in either direction. `UIActionSchema` requires `name`, which legacy inherits as optional from `BaseSchema`; legacy pins `type: 'action'` where these renderers serve `'script' | 'url' | 'modal' | 'flow' | 'api'`; and only the modern type declares `locations`, `target`, `endpoint`, `bodyExtra`, `bodyShape` and a `variant` union containing `'primary'` — all of which the implementations already read. objectui#4417 measured four compiler errors proving the VALUES were modern while the DECLARATIONS said legacy; this moves the declarations to match, so the contract and the implementation finally agree.

No runtime behaviour changes, and no published surface is involved: none of the six declarations is re-exported from the package index, and the sweep found zero type-checked consumers outside each declaration's own file. Metadata that renders today renders identically — the renderers read the same keys through the same paths.

Separately, all fifteen `schema`-reading `forwardRef` renderers in the package now annotate their render function's first parameter directly, and carry the pass-through index signature on that annotation rather than on the `forwardRef` type argument. `forwardRef` routes its type argument through `PropsWithoutRef`, whose `Omit` collapses a props type carrying `[key: string]: any` down to the bare index signature — every declared property erased, silently, with `noImplicitAny` reporting clean because the `any` is supplied explicitly by the index signature. That is what hid the declaration/implementation drift above for as long as it lasted. Thirteen renderers recover a real declared type for `schema` (the two raw-tag factories keep `any`, which is what they genuinely declare), and a new structural guard, `forwardref-props-annotation.guard.test.ts`, fails on any future `forwardRef` that reintroduces either half of the trap.
