---
'@object-ui/app-shell': patch
---

fix(app-shell): every CelPredicateField binds its label, so the RLS row-filter editors have an accessible name

`CelPredicateField` renders both halves of its own label association — the
`Label htmlFor` and the `Textarea id` — but `id` was an optional prop with no
fallback, so a call site that omitted it left both `undefined`: a label that
read correctly on screen and resolved to nothing, and an editor with no
accessible name.

The row-level-security `USING (read filter)` and `CHECK (write filter)` clauses
on the permission-set editor were mounted that way, which made the row-filter
authoring surface unreachable by label for screen readers and for
`getByLabelText`. The condition builder's CEL escape hatch was affected too.

`id` now falls back to a generated `useId()`, so the association is a property
of mounting the component rather than of every caller remembering the prop. An
explicit `id` still wins unchanged — the field inspector's four editors and the
conditional-formatting editor keep the exact ids they already had. The
autocomplete listbox is named off the same resolved id, so an id-less mount now
also carries the `aria-controls` that ties the combobox to its popup.
