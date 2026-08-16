---
'@object-ui/plugin-grid': patch
---

A bulk action dialog's per-option `visibleWhen` predicates now read the dialog's own in-progress param values.

The second landing site of the same gap objectui#3765 closed for the
single-record action dialog. A field's per-option `visibleWhen` reaches a bulk
param's control, but the dialog supplied no record to evaluate it against: it
passed no `dependentValues`, so the shared cascading-options evaluator fell
through its chain (`dependentValues ?? formValues ?? data`) to whatever record
the host grid page happened to publish, or to nothing at all. A predicate
written against a SIBLING PARAM — `record.country == 'cn'` on a province option,
next to a `country` param in the same dialog — could therefore never see the
value the user had just entered. Authored cascades were dead on this surface, in
the safe direction: an unresolvable predicate offers the option rather than
hiding it, so nobody was shown a wrongly-narrowed list.

Per the maintainer's 2026-08-11 ruling (Option B on objectui#3765) the dialog is
a small form, and its in-progress values are that record. The bulk dialog now
passes them as `dependentValues` to the option widgets (`select`, `multiselect`,
`radio`, `checkboxes` — the same allow-list the object form and the single-record
action dialog thread the live record to). The evaluator is unchanged; this is the
supply half that was missing.

Bulk is the cheap case for that ruling, which is why it needed no separate one:
an action over N selected rows has no single row record for the dialog's values
to displace — the selection was never offered to these predicates, so the
dialog's values are the only record there has ever been. What the supplied record
does displace is the host page's, since it wins the chain outright: a predicate
naming a column the dialog has no param for stays unresolvable, which fails open
— the option is offered, never wrongly hidden.
