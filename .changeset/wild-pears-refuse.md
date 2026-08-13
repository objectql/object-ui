---
'@object-ui/plugin-detail': patch
---

fix(plugin-detail): the record detail header honors `userActions` predicates

`userActions.delete` reached the record detail header in its **boolean** form
but not in its **predicate** form. `userActions: { delete: false }` removed
Delete from the row kebab, the selection bar and the detail header, because the
host lowers the boolean into `schema.showDelete`. `userActions: { delete: {
visibleWhen: … } }` reached only the row kebab: the header ANDed
`schema.showDelete ∧ objectAllowsDelete ∧ canDeleteRecord` and never evaluated
the predicate, so an author upgrading from "nobody may delete this object" to
"these records may not be deleted" silently lost the surface they were most
likely to have tested on.

The header now folds the per-record predicates in as a fourth conjunct,
evaluated against the open record through the same helper family the row
surfaces use — `userActionPredicates` from `@object-ui/core` for the parse (the
import `RelatedList` already makes) and `useRowPredicate` from
`@object-ui/react` for the evaluation:

- `delete.visibleWhen` / `edit.visibleWhen` false → the header affordance is
  hidden (fails closed; `visibleWhen: false` counts as a declared gate).
- `delete.disabledWhen` / `edit.disabledWhen` true → the header affordance
  renders disabled rather than disappearing, matching the row kebab.

The existing permission and record-writability gates are unchanged, so a
predicate that holds can never resurrect a button the user may not press. The
boolean form stays the host's channel — a bare boolean yields no predicate.
