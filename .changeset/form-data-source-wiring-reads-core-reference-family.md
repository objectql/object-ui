---
'@object-ui/components': patch
'@object-ui/core': patch
---

A `user` field in a form now receives `dataSource` / `dependentValues` / `dependsOnLabels`, like every other reference field.

The form renderer decided which registered widget gets those three props from a
module-private `DATA_SOURCE_FIELD_TYPES` set, while `@object-ui/core` kept
`EXPANDABLE_FIELD_TYPES` for the same underlying fact — a field whose stored
value is a foreign key into another object. The core side's TSDoc claimed to
mirror the form's set, and it did for 15 days: the form's copy then gained
`capability-multiselect` (objectui#2403) and the three widget-hint pickers
`object-ref` / `filter-condition` / `recipient-picker` (objectui#2421) on the
same day, after which the two sets were not in a subset relation in either
direction — `user` only in core, the picker names only in the form — with
nothing able to report it.

The form now derives its rule instead of restating it: the reference half is
core's set, the form-specific half is the three picker names, which are widget
hints and can never be a declarable field `type`. Adding a member to
`EXPANDABLE_FIELD_TYPES` therefore also grants it the form's data-source wiring;
that coupling is intended and is now written down on both sides.

The user-visible half is `user`. It previously received none of the three props.
`dataSource` and `dependentValues` each have a `SchemaRendererContext` fallback
inside the widget, so the person picker limped along wherever a provider
happened to supply one; `dependsOnLabels` has no fallback, so a
dependency-gated user picker interpolated the raw API name into its
"select ... first" hint in every locale — the leak objectstack#5407 closed for
lookups and left open here. The widget contract's own `dataSource` doc has
always named `user` among the types the form renderer injects for.

No change to what is expanded, projected or rendered anywhere else: the core
set's members are untouched.
