---
'@object-ui/fields': patch
---

The readonly `date` widget faces draw `formatDate`'s em-dash through the shared
`EmptyValue` affordance instead of a plain span (objectui#8809). Two sites:
`DateField`'s readonly branch and `FormulaField`'s `return_type: 'date'` path.

A truthy value `new Date(...)` cannot read — `not-a-date`, `2024-13-45` — used
to reach `formatDate`, which answers it with its own em-dash, and that dash was
painted in a span with no `data-slot` of `empty-value` and no accessible name.
A screen reader got naked punctuation. Same defect class as objectui#8475
(`RelatedList`) and objectui#8491 (`ObjectGrid`).

**The glyph does not change.** `EmptyValue`'s own default glyph is that same
em-dash, so the rendered text is identical and only the carrier moves: the dash
now has `data-slot` of `empty-value` and reads as "No value" (localized) to
assistive technology, muted like every other empty affordance.

That distinction is deliberate. objectui#8194 enumerated the four `formatDate`
sites, fed each the same unparsable value and split them 3-1 on purpose —
`GridField` keeps the raw stored string (objectui#3569, "showing the user what
is actually stored beats hiding it"), the other three inherit the shared empty
face. This change preserves that split rather than reopening it, and #8194's
three landed assertions stay green because they read rendered text.

A PARSEABLE value is untouched — it keeps its formatted face and carries no
affordance. The guard reproduces `formatDate`'s own parse, so it is
co-extensive with the dash it replaces and never wider.

Not swept in: the `$date` lookup fallback draws the same dash but returns plain
text rather than an element, so converging it is a decision about that
function's contract; and `GridField` is on the other side of the #8194 split.
