---
'@object-ui/app-shell': patch
---

fix(app-shell): the console record header honors `userActions` predicates

`userActions.edit` / `.delete` reached the console record page's header in
their **boolean** form but not in their **predicate** form.
`userActions: { delete: false }` hid Delete on the list row and on the record
header alike, because the switch flows through the affordance resolver
(`resolveRecordHeaderActionGates` → `resolveEffectiveCrudAffordances`). The
per-record object form — `edit: { visibleWhen: … }` — reached the list row
only: `synthSystemActions` gated on `objectAffordances.edit ∧
recordWriteAllowed` and never parsed, let alone evaluated, the predicate. An
author narrowing "who may edit this object" to "which records may be edited"
therefore kept the converged list and lost the record page, where the Edit
button still opened a form the server would reject on save.

The header now folds the per-record predicates in as a fourth conjunct,
evaluated against the open record through the same helper family the row
surfaces use — `userActionPredicates` from `@object-ui/core` for the parse and
`useRowPredicate` from `@object-ui/react` for the evaluation:

- `edit.visibleWhen` / `delete.visibleWhen` false → the synthesized header
  action is not emitted (fails closed; `visibleWhen: false` counts as a
  declared gate).
- `edit.disabledWhen` / `delete.disabledWhen` true → the header affordance
  renders disabled rather than disappearing, matching the row kebab. On
  `sys_edit` this composes with `OR` onto the `disabled` key the approval lock
  already used, so an approval lock and a declared predicate stay independent
  reasons for the same off.

The record body's inline-edit session joins the same conjunction, exactly where
the approval lock already sits, so the header CTA and the body pencils cannot
disagree about whether this record may be edited.

The existing affordance, permission and record-writability gates are unchanged
and the predicate only ever subtracts, so a predicate that holds can never
resurrect a button the bucket closed or the user may not press. The boolean
form stays the affordance resolver's channel — a bare boolean yields no
predicate.

This completes the convergence started in the row kebab and continued in
`plugin-detail`'s `DetailView` header: one authored predicate, one evaluator,
one answer on all three surfaces.
