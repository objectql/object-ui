---
'@object-ui/plugin-list': patch
---

`ListView` reads `exportOptions.streaming` without a cast (objectui#6956). The
two `as any` reads — the `exportableFormats` server-availability check and
`handleExport`'s server-eligibility gate — and the `'pdf'` in the bare-array
fold's cast are gone: the `ListViewSchema` type now carries `streaming` and not
`'pdf'`, because `@object-ui/types`' zod mirror binds the spec's `exportOptions`
field by reference. No behaviour change: the same formats are offered,
`streaming: false` still forces the client-side path, and the bare-array fold
(`resolvedExportOptions`, a stored `['csv', 'xlsx']` folded to `{ formats }`)
STAYS — nothing on the render path parses and `ObjectView` forwards a stored
value verbatim, so the spec's parse-time lift never runs before this renderer
and the fold is load-bearing rather than legacy. A `'pdf'` stored before the
retirement still arrives as data and is still dropped from the export menu with
the existing one-time warning.
