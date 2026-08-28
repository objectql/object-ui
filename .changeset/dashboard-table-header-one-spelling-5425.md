---
'@object-ui/plugin-dashboard': patch
---

A dashboard table's auto-derived column headers spell a field key the same way every other path in the `table` widget family does.

`ObjectDataTable` derives headers on two paths — from the author's declared
`columns`, and from the object schema when no columns were declared. The
declared path (and the static `data-table` half of the same widget family)
already used `humanizeFieldKey`, whose docstring names it "the single home for
the convention, because both halves of the `table` widget family need it and
they must agree". The auto-derived path carried a third, inline spelling that
split camelCase but never turned `_` into a space, so it left a raw underscore
on screen. Measured over the same object's columns:

```
path                                     close_date    needs_analysis
object-bound, AUTO-DERIVED   (before)    Close_date    Needs_analysis
object-bound, AUTO-DERIVED   (after)     Close Date    Needs Analysis
object-bound, DECLARED columns           Close Date    Needs Analysis
static `data-table`, no columns          Close Date    Needs Analysis
```

One dashboard can hold all three widgets over one object, so a single field key
rendered under two spellings — the defect class objectui#5425 rules out. The odd
path adopts the shared convention rather than the convention gaining a fourth
dialect. camelCase keys are unaffected (`unitPrice` read `Unit Price` before and
after — the coincidence that kept the snake_case divergence unnoticed), and a
translated header still wins: only the fallback handed to `fieldLabel` changed.

Dimension MEMBER labels are untouched by this. The same card reported dashboard
members rendering a prettified enum instead of the picklist's translated label,
measured on 17.1.0; re-measured on this branch it no longer reproduces — the
analytics label net shipped in 17.5.0 routes every non-metric dataset dimension
through the field's declared options and the locale bundle. That behaviour had
no test stated in the card's terms and now has one, over the four dashboards the
card measured, including the property that a bar axis and a pivot header cannot
disagree about one stored value.
