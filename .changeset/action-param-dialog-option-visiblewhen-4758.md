---
'@object-ui/components': patch
---

`ActionParamDialog` (the `custom` barrel's published dialog) now resolves each
`select` param's options through `@object-ui/core`'s shared option evaluator, so a
per-option `visibleWhen` narrows the offered list here exactly as it does on the
app-shell action dialog and in the object form (objectui#4758).

This surface is the repo's second action-param dialog, and its `select` branch
rendered `param.options?.map(...)` straight into Radix items. A per-option
`visibleWhen` was not evaluated wrongly — it was not evaluated at all, so an option
gated on `record.*` (a sibling param) or on `current_user.*` was offered
unconditionally, while the app-shell dialog filtered the identical field metadata.
Triage ruled the governed side authoritative; the dialog rebinds to
`resolveVisibleOptions`, resolving predicates against the dialog's own in-progress
values (the objectui#3765 Option B ruling) plus the ambient predicate scope.

Rebind, not removal: the component stays a published export, its props and every
other branch are untouched, and retiring it remains a separate decision.

A selection the predicate stops offering is now cleared rather than kept as a hidden
value — the same `isValueStillOffered` clear `SelectField` already performs. Without
it, filtering alone would let a picked-then-gated-out option vanish from the trigger
while still riding in the submitted payload. Params whose options declare no
predicate are untouched.
