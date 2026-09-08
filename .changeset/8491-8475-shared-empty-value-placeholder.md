---
'@object-ui/plugin-grid': minor
'@object-ui/plugin-detail': minor
---

`ObjectGrid` and `RelatedList` now draw the shared `EmptyValue` for a missing
cell value instead of each spelling its own placeholder (objectui#8491,
objectui#8475).

**The accessibility defect.** Both components built a plain span holding a bare
em-dash, classed `text-muted-foreground/50 text-xs italic`. The shared
`EmptyValue` in `@object-ui/components` carries three things that span did not:
a `data-slot` of `empty-value`, an `aria-label` resolved through the i18n label
hook, and `select-none` / `no-underline` / `pointer-events-none`. So an empty
cell had **no accessible name at all** — a screen reader heard a naked
punctuation mark — while its renderer-supplied neighbour in the next column was
announced as "No value". In `RelatedList` the two outcomes were reachable in the
*same column*: an empty string took the hand-rolled branch, an unparseable
`datetime` reached `DateTimeCellRenderer` and got the real one. Inside a link
column the hand-rolled placeholder also inherited the link colour and was
selectable, so a missing value looked clickable and could be copied.

**A deliberate visual change, not a no-op.** The three grid cell sites and the
related-list site drop `text-xs italic` and adopt the shared component's
typography. That is the point: `ObjectGrid`'s no-renderer default branch already
returned `EmptyValue`, so one table could show a 12px italic placeholder in one
column and the shared upright one in the next. They are now byte-identical.

**A fourth site, and a purely additive change there.** The grid's record-detail
drawer had the same hand-rolled placeholder in a `text-sm` spelling, which the
originating census missed. It adopts `EmptyValue` too, but keeps its rendered
text and typography through `glyph` and `className` — the `grid.empty` string
has exactly one call site in the workspace and dropping it would strand a
translated value in ten locale packs. Its delta is the three affordances only.

Filled cells are untouched in every path, including the grid's stacked card
layout below 768px.
