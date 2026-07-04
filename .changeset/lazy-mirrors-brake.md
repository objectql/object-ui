---
'@object-ui/components': patch
'@object-ui/plugin-form': patch
'@object-ui/app-shell': patch
'@object-ui/types': patch
---

Fix view-level `FormField.visibleOn` (CEL) never taking effect (#2212).

The spec ships `visibleOn` as an Expression object `{ dialect: 'cel', source }`
(what the `P` template emits) or a bare string, but the whole chain dropped it:

- `sectionFields.ts` / `ObjectForm.tsx` only accepted the bare-string shape and
  attached a dead `visible()` closure no renderer ever called — the Expression
  object shape was silently discarded.
- The form renderer destructured `visibleOn` out of the field config and never
  evaluated it.
- `RecordFormPage` dropped a `simple` form view's `sections` entirely, so
  page-mode create/edit fell back to the raw schema (every field, no authored
  selection/grouping) while the modal path honored the same view.
- `ObjectForm`'s grouped-sections path matched section fields by name only,
  dropping per-field `visibleOn` overrides.

`visibleOn` now flows through normalization verbatim (both wire shapes) and is
evaluated reactively by the form renderer with the canonical expression engine
(`evalFieldPredicate` — same engine, record scope, and fail-open semantics as
field-level `visibleWhen`; both predicates must allow a field for it to show).
Sectioned/flat normalization also copies field-level `visibleWhen` /
`readonlyWhen` / `requiredWhen` rules it previously lost.
