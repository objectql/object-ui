---
'@object-ui/components': patch
---

`ui:header-bar` now resolves a crumb's authored `icon` to a glyph instead of drawing
nothing (objectui#6645).

`HeaderBarSchema.crumbs` is typed `BreadcrumbItem[]` — the same declaration
`BreadcrumbSchema.items` uses — and its Zod mirror does not merely declare `icon`, it
**describes** it (`.describe('Breadcrumb icon')`), so any authoring surface that reads Zod
`describe` can already offer the key to an author. `header-bar.tsx` contained zero
occurrences of the substring `icon`.

After PR #6644 repaired the breadcrumb side, **one declared key behaved differently on its
two consumers**: authored on a `breadcrumb` item it drew a glyph, authored on a
`header-bar` crumb it drew nothing. The asymmetry was invisible only because it had been a
uniform zero on both. It is now asserted directly — one crumb object is rendered through
both renderers and the resolved glyph compared, in the positive direction and on a retired
spelling.

Resolved through the **shared** `resolveIcon`, never a local normaliser: objectui#5993 is
the standing lesson that a local copy is the same algorithm under a different function, and
the alias later added there to absorb a lucide retirement reached every `action:*` site
except `ui:button`. So this is the lucide **record** surface — a live name draws its glyph,
an unknown or retired spelling draws nothing rather than degrading to a wrong one. The
`home` -> lucide `House` rename lives only in the shared resolver's map, and a pin asserts
it from the outside, so a future local re-implementation is red.

The glyph renders once per crumb inside `BreadcrumbItem`, **above** `BreadcrumbLabel`, so
all three of that helper's arms — the siblings quick-switch dropdown, the last crumb's
`BreadcrumbPage`, and every earlier `BreadcrumbLink` — carry it by construction rather than
one at a time.

Scored `patch`, matching PR #6644's scoring of the identical repair on the sibling
consumer: no new capability, a declared key that drew nothing starts drawing.

A `crumbs-with-icons` catalog fixture authors the key and the docs page documents it, so
this does not come back next round as "declared but unenforced". The icon-record gate gains
a `header-bar` census entry for the same reason `context-menu` gained one in objectui#6278:
until the repair the names reached no resolver and declining them was correct, and a census
entry is a fact about a renderer. That is not objectui#5992's blind spot, which is the gate
*guessing* at containers nobody read off a renderer.
