---
'@object-ui/components': patch
---

fix(components): the `page` wrapper now filters its DOM attributes through the shared whitelist instead of a hand-maintained list

`PageRenderer` stripped PageSchema's descriptor keys with a hand-maintained
destructure list and spread the remainder onto its wrapper `<div>`. Whenever
that list fell behind the schema, an authored key was not dropped — it was
forwarded, and React stringifies unknown attributes in silence, so an authored
`actions: [{…}, {…}]` reached the DOM as `actions="[object Object],[object
Object]"`.

The renderer now calls `toDomProps` from `@object-ui/core` — the same
whitelist every converged SDUI widget already uses (objectui#4425). Twenty-five
attributes measured leaking off the wrapper stop being emitted, including the
`context` bag the console injects into every page it renders. Everything the
wrapper legitimately carries is unchanged: `class`, `style`, `id`, `role`,
`tabindex`, `data-page-type`, `data-obj-id`, `data-obj-type`, and the open
`data-*` / `aria-*` families.

This changes no schema's accept/reject behaviour — `BaseSchema.passthrough()`
is untouched — and adds no read point for any previously leaking key.
