---
'@object-ui/core': patch
---

`formatDate` reads `options.style` (objectui#7745).

`DateDisplayOptions` is the one bag `formatDate` / `formatRelativeDate` /
`formatDateTime` share. `style` was added to it for `formatDateTime`'s `'compact'`
grid face (objectui#7443, PR #7621) and only `formatDateTime` read it, so on
`formatDate` the key was inert — and inert beside a POSITIONAL parameter of the same
name. `formatDate(v, undefined, { style: 'short', locale: 'en-US' })` rendered
`Jul 4, 2024`, the default face, with no diagnostic; it now renders `Jul 4, '24`.
This is the additive half of the maintainer's long-run ruling on objectui#7443:
both functions accepting `options.style`.

**The precedence is pinned: the positional argument wins.** `options.style` is
consulted only when the positional slot is `undefined` (`??`, not `||`, so `''`
still counts as given). That is the only direction that is purely additive — it
fires exactly on the input that is a silent no-op today, so no call that renders a
face today renders a different one after. The reverse would let a key aimed at a
SIBLING function outrank an argument written for this call: the bag is shared, and
carrying `{ style: 'compact', locale }` built for `formatDateTime` into
`formatDate(v, 'short', bag)` must not cost that call its short face.

**What changes for you.** Only `formatDate(value, undefined, { style: 'short' | 'relative' })` —
a call that silently rendered the default face before. Every call that passes the
style positionally, and every `formatDateTime` / `formatRelativeDate` call, renders
byte-identically to before.

`formatRelativeDate` still does NOT read `style`; the ruling names `formatDate`
only. Its out-of-window fallback to `formatDate` strips the key so that the new read
cannot leak in through the delegation — which also keeps
`formatRelativeDate(v, { style: 'relative' })` from recursing.
