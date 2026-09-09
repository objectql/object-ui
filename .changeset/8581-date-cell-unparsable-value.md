---
'@object-ui/fields': patch
---

`DateCellRenderer`: an unparsable date value renders the shared `EmptyValue`
affordance instead of `formatDate`'s hand-rolled em-dash (objectui#8581).

A `date` column holding `not-a-date` used to reach `formatDate`, which returns
its own `'—'` for any value whose `new Date(...)` is invalid, and the renderer
wrapped that string in a span classed `tabular-nums`. The result was naked
punctuation: no `data-slot` of `empty-value`, no accessible name — the same
defect class as objectui#8475 (`RelatedList`) and objectui#8491 (`ObjectGrid`).
objectui#8490 routed this renderer's coerced-EMPTY input (`[]`, `''`,
whitespace) to the shared affordance and left this input for its own card.

The guard is now spelled exactly as `DateTimeCellRenderer`'s one function down
— the nearest sibling, which answers the identical input and has returned
`EmptyValue` all along. The two date renderers no longer disagree about the
same value, and that agreement is measured in the pin, not asserted.

**Visible change.** An unparsable value now reads "No value" to a screen reader
and is muted like every other empty cell. The raw string that was reachable on
hover through that span's `title` is gone on this branch only — nothing in the
tree read it (searched with lit controls before the change). A PARSEABLE value
is untouched: it keeps its formatted face, its overdue colour and its ISO
`title`. A numeric epoch timestamp still renders — the guard reproduces
`formatDate`'s own parse, so it is co-extensive with the dash it replaces and
never wider.
