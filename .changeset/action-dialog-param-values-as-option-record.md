---
'@object-ui/app-shell': patch
---

An action dialog's per-option `visibleWhen` predicates now read the dialog's own in-progress param values.

A field's per-option `visibleWhen` reaches a dialog param's control (objectui#3559),
but the dialog supplied no record to evaluate it against: it passed no
`dependentValues`, so the shared cascading-options evaluator fell through its
chain (`dependentValues ?? formValues ?? data`) to the host page's record, or to
nothing at all. A predicate written against a SIBLING PARAM — `record.country ==
'cn'` on a province option, next to a `country` param in the same dialog — could
therefore never see the value the user had just entered. Authored cascades were
dead on this surface, in the safe direction: an unresolvable predicate offers the
option rather than hiding it, so nobody was shown a wrongly-narrowed list.

Per the maintainer's 2026-08-11 ruling (Option B on objectui#3765) the dialog is
a small form, and its in-progress values are that record. The dialog now passes
them as `dependentValues` to the option widgets (`select`, `multiselect`,
`radio`, `checkboxes` — the same allow-list the object form threads the live
record to). The evaluator is unchanged; this is the supply half that was missing.

Ruled consequence, stated because it is a behavior change and not only a fix: a
supplied record wins that chain outright, so an option predicate naming a field
of the underlying ROW that the dialog has no param for no longer resolves inside
a dialog. It becomes unresolvable, which fails open — the option stays offered,
never wrongly hidden. Merging the two records was the alternative reading and was
deliberately not taken: it would introduce a third scope dialect that has to be
written into the contract before anything can rely on it.
