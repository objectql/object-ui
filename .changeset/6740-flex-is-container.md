---
'@object-ui/components': patch
---

`flex` declares the containment it renders (objectui#6740).

`flex` has always rendered `schema.children`, but its registration omitted
`isContainer` while `grid`, `card`, `container` and `stack` — same directory,
same `ui` namespace — all declared it. The render path never reads the flag, so
nothing was broken at runtime; its consumers are elsewhere, and the gap made
them contradict the renderer.

MEASURED through the mechanism, not inferred from the property. Building the
manifest the way the app builds it (`getKnownTypes()` + `getMeta()` ->
`manifestFromConfigs`) and putting a `flex` node carrying children through
`validateTree` returned `["not-a-container"]`, while `grid` / `card` /
`container` under the identical probe returned `[]` — the control that makes
that reading real. Downstream, objectstack's three shipped
`examples/app-showcase` html pages drew 232 diagnostics, of which every one of
the 32 warnings was `not-a-container` on `flex`, and `flex` was their only
source. `validateTree` is not on objectstack's production gate path today, so
the warnings are currently unobserved — which is why this is worth closing
before that gate goes live rather than after.

**Second consumer, and the reason this is not purely a declaration change.**
`renderers/layout/react-page.tsx` builds the JSX scope of every `kind:'react'`
page with `if (!tag || cfg.isContainer) continue;`. While `flex` omitted the
flag it was the one layout primitive of the five still injected there, so
`<Flex>` resolved in react page source — and rendered an EMPTY div, because the
injected wrapper drops `children`. It now behaves like its four siblings and is
not injected, which is what `content/docs/guide/react-pages.md` has documented
all along ("Layout containers are deliberately not injected ... `<flex>`,
`<grid>`, `<card>` and friends have no injected wrapper"). A react page that
wrote `<Flex>` moves from silently swallowing its children to the page-level
error panel naming the identifier, with that page's documented remedy being
real HTML: `<div style={{ display: 'flex', gap: 16 }}>`.

Pinned over the family rather than over `flex` alone: the defect's shape was
"three declare it and one does not", and a pin covering only the one that was
missing would let the next registration rot the same way.
