---
'@object-ui/components': patch
---

**Behaviour change:** the `flex`, `stack`, `container` and `text` renderers no
longer forward their whole prop bag to the host element. They route it through
`toDomProps` — the same whitelist `grid` was converged on — so an authored
schema key becomes an HTML attribute only if the SDUI DOM contract declares it
one (objectui#5574).

What this stops reaching the DOM: the renderer's own declared props, which were
consumed off `schema` to build the class list AND spread onto the element a
second time as attributes HTML does not define. Measured across
`examples/schema-catalog`, rendered through the real `SchemaRenderer`: 1194
illegitimate attributes over 1141 nodes — `text[content]` 522, `flex[align]`
198, `flex[gap]` 193, `stack[gap]` 153, `flex[justify]` 98, `container[padding]`
14, `container[maxwidth]` 6, `flex[direction]` 5, `stack[align]` 4,
`text[value]` 1. The same probe reads 0 after, with `grid`'s 26 nodes at 0 both
times as the control.

Nothing an author writes renders differently: every leaked key was already being
read off `schema` and applied as a class, so the markup loses attributes that
never had meaning and keeps the styling that did. `id`, `role`, `tabIndex`,
`className`, `style`, event handlers and the open `data-*` / `aria-*` families
are unchanged — including `data-obj-id` / `data-obj-type`, which now arrive
through the `data-*` family rather than by hand.

Anything that read one of the leaked attributes off the DOM — a CSS attribute
selector such as `[gap="4"]`, or a test asserting `align` on a rendered `flex` —
must read the schema or the class instead. No `@object-ui` code did; this is
called out because the attributes were externally visible while they lasted.
