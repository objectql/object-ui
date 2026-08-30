---
---

The five `aspect-ratio` docs demos now author the keys the renderer reads, so every demo on
the published page draws its content instead of an empty ratio box (objectui#6773).

`packages/components/src/renderers/layout/aspect-ratio.tsx` reads `ratio`, `className`,
`image` (with `alt`) and `children || body` — never `content`, which is what all five
entries authored and nothing else. Measured on `c6732825d`, each rendered 3 elements, no
text and no `img`: the Radix wrapper for the ratio itself, with nothing inside it. The
photo demo now authors `image` + `alt`, the renderer's own declared inputs, whose `<img>`
is sized to fill the box; the four card demos author `children` at BOTH levels — the
nested `card` never read `content` either, so moving only the outer key would have traded
an empty box for an empty card. The page's Schema block published `content` as contract
while omitting `image`/`alt`; it now documents what the renderer reads.

Nothing publishes from this change — a docs page plus `@object-ui/example-schema-catalog`
fixtures, both outside the release — hence the empty frontmatter. The regression control is
`examples/schema-catalog/test/aspect-ratio-demo-content-6773.test.tsx`: category scope, not
a list of five ids, with a counter-probe that renders the pre-fix shape and proves the
assertion can still fail.
