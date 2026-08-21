---
'@object-ui/components': patch
---

The `ui:grid` renderer now forwards to the DOM by whitelist, so schema keys no longer
land on the rendered `<div>` as invalid HTML attributes (objectui#4787).

`grid.tsx` ended in a bare `{...gridProps}` spread that removed only `data-obj-*` and
`style`, so everything else `SchemaRenderer` hands a registered component reached the
element. Measured on a canary node, eight attributes leaked:
`columns="4"`, `gap="4"`, `mdcolumns="2"`, `smcolumns="2"`, `name="grid_node"`,
`props="[object Object]"`, `colorvariant="x"` (the flattened `props` container) and an
unknown authored `zzcanary="leak"`. A responsive `columns` object rendered as
`columns="[object Object]"`. Layout was unaffected, so every catalog grid example
rendered with them — the reason this went unnoticed.

The spread now goes through `toDomProps` from `@object-ui/core`, the same whitelist
objectui#3291 established in `packages/fields` and objectui#4425 phase 2 promoted to the
SDUI widget contract. Keys that are *declared* DOM-safe survive — `id`, `className`,
`role`, `tabIndex`, plus the open `data-*` and `aria-*` families, which is how the
designer's `data-obj-id` / `data-obj-type` still arrive — and `style` continues to be
forwarded by name. Nothing an author can add to a grid node reaches the DOM implicitly
any more, including keys `GridSchema` does not have yet; enumerating today's keys to
strip would have re-rotted on the next schema addition.

No authored input changes and no layout changes: the grid's own vocabulary was always
read off `schema`, never off these props.
