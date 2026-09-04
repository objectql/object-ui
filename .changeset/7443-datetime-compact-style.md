---
'@object-ui/core': minor
'@object-ui/fields': minor
'@object-ui/components': minor
'@object-ui/plugin-gantt': minor
---

One home for the `datetime` display convention (objectui#7443).

`formatDateTime` gains a named `'compact'` style — the dense grid face,
`7/4/2024 7:00 am` in `en-US` — which `DateTimeCellRenderer` used to build from
its own inlined `Intl` option bags. The cell now reads `field.format` (it
destructured `value` only, so a `datetime` field could not reach the style
vocabulary a `date` field has) and renders through the shared function, and
`data-table`'s `formatCellValue` calls `formatDateTime` instead of a third,
independently authored option bag. Every existing cell renders byte-identically;
`'compact'` is today's face named and rehoused, not a new one.

BREAKING (source-compatible only after moving one argument): `formatDateTime`'s
signature is now `(value, style?, options?)`, matching `formatDate`. The
`options` parameter added in objectui#4272 moved from position two to position
three — `formatDateTime(v, { locale })` becomes
`formatDateTime(v, undefined, { locale })`. TypeScript rejects the old form at
every call site; a JavaScript caller that does not move the argument silently
loses its locale, which is the objectui#4272 defect. Marked `minor`, per this
repo's fixed-group rule that a breaking change is described rather than
majored.
