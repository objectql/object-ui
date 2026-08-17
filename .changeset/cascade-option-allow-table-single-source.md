---
'@object-ui/core': patch
'@object-ui/fields': patch
'@object-ui/components': patch
'@object-ui/app-shell': patch
'@object-ui/plugin-grid': patch
---

The allow-list of option widgets that are fed the live record is now one exported constant, `CASCADE_OPTION_WIDGET_TYPES`, instead of three private copies.

`select` / `multiselect` / `radio` / `checkboxes` are the widgets whose OFFERED
option set is re-resolved against a record (per-option `visibleWhen`, plus the
`dependsOn` gate), so they are the widgets a surface must thread its live record
to. Three surfaces feed that one evaluator — the object form, the single-record
action dialog and the bulk action dialog — and until now each carried its own
private `new Set([...])` of the same four keys, with a comment in each asking the
next person to change all three together. Nothing could have reported them
drifting: every copy passed its own behavioural tests, and a divergence would
have shown up only as one surface silently disagreeing with another about what
"the record" is.

The set now lives in `@object-ui/core`, next to `resolveCascadingOptions` — the
evaluator that reads that record — because core is the one package all three
surfaces already depend on, and it is re-exported from `@object-ui/fields` next
to `resolveFormWidgetType`, whose output is the vocabulary the keys are written
in. Both are the same object, pinned by test; each consumer keeps its own
normalization (`normalizeFieldType` in the form, `resolveFormWidgetType` in the
dialogs), which agree on these four members.

No behaviour changes: the members are identical on all three surfaces, and the
existing pins for each surface still assert the same records reaching the same
widgets. The rationale that was repeated in the three copies — including the
note that the widget-hint picker family (`filter-condition`, `recipient-picker`,
the lookup family) reads a different sibling key off the same channel and is
deliberately NOT in this set — is now stated once, in the constant's own
documentation. Whether the action and bulk dialogs should ever feed those
pickers stays an open question (objectui#4771), unchanged by this convergence.
