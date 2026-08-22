---
'@object-ui/plugin-form': patch
---

`README.md`'s "Not a `FormField` key" table said a field-level `className` is
"read on exactly one pseudo-field, `type: 'section-divider'`". That quantifier
holds only for the renderer's *explicit* read — `className={fp.className}` on
the `section-divider` branch of
`packages/components/src/renderers/form/form.tsx`. The same renderer forwards
every key it did not destructure, and `className` is not among the names taken
off the field config, not among the ones `stripRendererOnlyProps` removes, and
so rides `{...fieldProps}` into `renderFieldComponent`, whose built-in `input`
branch spreads it onto `<Input>`. A field-level `className` therefore lands
visibly on ordinary built-in controls, and a reader taking "exactly one"
literally concludes the opposite of what the code does (objectui#5131).

The cell now describes the contract rather than the reader count: an undeclared
key still rides the props spread down to whichever component the field resolves
to, nothing in the contract promises that, and a registered widget honours it
only if it happens to spread its leftover props — the wording the docs site
already ships, so the two sources agree again. The advice in the row is
unchanged and was never wrong (`span` / `colSpan` for width,
`FormSchema.fieldContainerClass` for the grid), and the explicit
`section-divider` read is kept, now named as explicit.

This is a documentation fix to a file `plugin-form` publishes to npm, which is
why it carries a version: the npm landing page only picks up the correction on a
release. No behaviour, export, type, or `dist` byte changes.
