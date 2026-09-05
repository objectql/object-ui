---
'@object-ui/core': minor
'@object-ui/fields': minor
'@object-ui/components': patch
---

One home for the `datetime` display convention (objectui#7443).

`formatDateTime` gains a named `'compact'` style, selected through
`options.style` — the dense grid face, `7/4/2024 7:00 am` in `en-US` — which
`DateTimeCellRenderer` used to build from its own inlined `Intl` option bags.
The cell now reads `field.format` (it destructured `value` only, so a
`datetime` field could not reach the style vocabulary a `date` field has) and
renders through the shared function, and `data-table`'s `formatCellValue`
calls `formatDateTime` instead of a third, independently authored option bag.
Every existing cell renders byte-identically; `'compact'` is today's face
named and rehoused, not a new one.

Additive, no signature change: `formatDateTime(value, options?)` is unchanged
and `formatDateTime(v, { locale })` keeps meaning what it meant.
`DateDisplayOptions` gains an optional `style` key (read by `formatDateTime`
only; `formatDate` still takes its style positionally), and
`formatDateTimeCompactParts` is a new export of `@object-ui/core`, re-exported
by `@object-ui/fields`, returning the compact face as the two halves a grid
cell paints separately. `@object-ui/components` changes no rendered output —
the table's datetime cell is measured identical before and after in `en-US`,
`zh` and `de-DE`.
