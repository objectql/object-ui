---
'@object-ui/react': patch
---

fix(react): stop the form-view bridge silently dropping 18 spec keys

`spec-bridge/bridges/form-view.ts` promised (#2545) that "every serializable
spec key is either mapped onto the `object-form` node or listed here with an
explicit reason for being ignored". Measured against `@objectstack/spec` 17.2.0
the promise was false for 18 keys, because the conformance test enforcing it ran
its completeness loop over its own hand-written fixture rather than the
contract's key set.

Seventeen of them now reach the node, at the destinations the receiving layer
already reads:

- `FormViewSchema.buttons` / `.defaults` — `ObjectFormSchema` declares both and
  `ObjectForm` folds them at render (action-button visibility/labels, and
  create-mode initial values).
- `FormSection.pane` — explicit split-pane placement; without it a spec-authored
  split form fell back to the positional rule, so reordering sections moved them
  across the divider.
- `FormSection.visibleOn` — the deprecated spelling now folds onto `visibleWhen`,
  matching the contract's own parse-time normalisation and the field path.
- Thirteen `FormFieldSchema` keys — `maxLength`, `minLength`, `min`, `max`,
  `precision`, `scale`, `multiple`, `immutable`, `span`, `language`, `keyField`,
  `disclosure`, `fields` — so authored constraints, composite config and field
  width survive the bridge instead of ending there.

`publicPicker` is deliberately not carried and now says so: it is a server-side
public-lookup authorization opt-in with no client destination.

The conformance test's key set is now derived from the contract's own shape at
all three levels, so a spec key that is neither mapped nor explained fails the
suite by construction.
