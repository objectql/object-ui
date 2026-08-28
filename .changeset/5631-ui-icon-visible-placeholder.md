---
'@object-ui/components': minor
---

`ui:icon`: an unresolvable glyph now renders a visible placeholder instead of nothing

An icon whose name does not resolve to a lucide glyph used to `return null`.
That failed silently in two independent ways at once: invisible to a human (no
gap, no error boundary — just an absent glyph), and clean-looking to a gate (a
renderer that returns `null` spreads no attributes, so a DOM scan of it reports
no findings).

It now renders a dashed-square placeholder on the same SVG host, keeping the
authored `className`, `size` and colour so the gap sits exactly where the icon
would have been, with `role="img"`, an accessible name identifying the icon
that failed, and a `data-objectui-icon-unresolved` marker. The `console.warn`
stays and now names the cause.

Also fixed: a node with no `name` at all reached `toPascalCase(undefined)` and
threw, which the error boundary then swallowed — a third silent failure. It
renders the placeholder too.

Not included: `ui:icon` still reads the SDUI identity key `name` as its glyph
name. Moving it to `schema.icon` is ruled but blocked on an authored-metadata
migration — see objectui#5631.
