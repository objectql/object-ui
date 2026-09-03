---
"@object-ui/components": patch
---

`ui:text` now honours `TextSchema.variant` and `TextSchema.align`

The nine published variants (`h1`-`h6`, `body`, `caption`, `overline`) each map to
a distinct typographic class, and `h1`-`h6` render the heading element they name;
the four published alignments (`left`, `center`, `right`, `justify`) reach the DOM
as their Tailwind class. The registration's `inputs` list declares both keys, so
the JSX-page prop whitelist stops reporting `unknown-prop` for them.

The published enum is unchanged — the renderer catches up to it, and a spelling
outside the enum is still refused by `safeValidateSchema` rather than quietly
ignored. Behaviour note: a document that already authored `variant: 'h1'` and saw
no heading will now see one. That is the declared behaviour arriving. A node that
never authored `variant` renders exactly as before.
