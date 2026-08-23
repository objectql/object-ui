---
'@object-ui/react': minor
---

The spec-bridge's form-view input now accepts everything `@objectstack/spec`'s
FormViewSchema accepts — three key types had drifted narrower, and one of them
had inverted (objectui#5652).

`bridges/form-view.ts` held a third hand-written description of the FormViewSchema
contract, after the leaf (objectui#5542) and the two containers (objectui#5596)
were converged elsewhere. A description nothing compares is one spec release from
being a fork, and this one had already drifted on the keys that decide whether a
legal document renders:

- `FormSection.columns` refused the string spelling of a column count, which the
  contract admits and folds to a number in its own pipe. It is now the contract's
  type, and the bridge performs the fold — the `object-form` node's section
  declares `columns` as a number and its container indexes a grid-class map by
  it, so forwarding `'2'` handed every downstream renderer a value outside the
  type it declares.
- `FormField.dependsOn` was declared `string[]`, which is the exact inverse of the
  contract: it admitted only the array arm the contract rejects, and refused the
  bare parent-field name that is the one configuration making `field-selector`
  and `dynamic-config` work (objectui#5040).
- `visibleWhen`, on both fields and sections, was declared `string`, so the
  ADR-0089 expression object — the arm `evalFieldPredicate` reads — could not be
  described at all. Both arms now travel whole onto the node.

A section's `fields` may also be a bare object-field name, the spec shorthand the
list bridge already honours. The form bridge ran it through the object mapper
instead, producing a field with no identity (`{ name: undefined }`) for the most
ordinary section a form can declare; it is now forwarded verbatim, which is what
the node's own `fields` slot admits.

Each drift-prone key's type is now bound to the `@objectstack/spec` symbol that
owns it rather than restated, so it cannot drift again, and the compile-time pins
in `FormViewWidenedArms.test.ts` fail if a future edit restates any of them by
hand. The documented subset itself is unchanged: the keys this bridge does not
declare, including the retirement ledger it keeps, stay exactly as they were.
