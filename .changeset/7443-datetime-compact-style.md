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
Every existing cell without an authored `format`, and every cell authoring
`'compact'`, renders byte-identically; `'compact'` is today's face named and
rehoused, not a new one. A `datetime` field that authors any OTHER non-empty
`format` does change: the cell previously ignored `field` altogether and always
painted the compact face, and now anything other than `'compact'` selects the
verbose `formatDateTime` default — measured as `Jul 4, 2024, 07:00 AM` in
`en-US` for the instant whose compact face is `7/4/2024 7:00 am`. An
unrecognised value is neither rejected nor passed through; it silently lands on
that verbose face. No `datetime` field in this repository authors a `format`, so
no cell here moves — a consumer that authored one is the case this sentence is
for. Note that `format` has no declared value vocabulary to check a value
against: `@object-ui/types` types it `format?: string`, and `@objectstack/spec`
carries one free-form `format?: string` on its shared field schema, described
"Format string (e.g. email, phone)" and accepting any string. `'compact'` is
therefore the only value with a defined `datetime` meaning, and every other
value means "the verbose face" by fallthrough rather than by design.

Additive, no signature change: `formatDateTime(value, options?)` is unchanged
and `formatDateTime(v, { locale })` keeps meaning what it meant.
`DateDisplayOptions` gains an optional `style` key (read by `formatDateTime`
only; `formatDate` still takes its style positionally), and
`formatDateTimeCompactParts` is a new export of `@object-ui/core`, re-exported
by `@object-ui/fields`, returning the compact face as the two halves a grid
cell paints separately. `@object-ui/components` changes no rendered output —
the table's datetime cell is measured identical before and after in `en-US`,
`zh` and `de-DE`.
