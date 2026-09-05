---
'@object-ui/plugin-markdown': patch
---

Fix `extractToc` eating the underscores out of a `SCREAMING_SNAKE` heading, so
its `#id` links resolve to the heading they name again (objectui#7667).

`stripInline()` ended with two hand-rolled emphasis rules that gave `*` and `_`
one shared regex — `(\*\*|__)(.*?)\1` and `(\*|_)(.*?)\1`. Neither knew
CommonMark's flanking rule, under which a `_` run INSIDE a word opens nothing:
it is both left- and right-flanking with no adjacent punctuation, so it may
neither open nor close emphasis. The renderer obeys that and keeps the
underscores; the shared rule paired the first two underscores of
`### NON_GRID_ROW_CEILING` and ate `GRID`, then resumed and ate `ROW`. The TOC
said `nongridrow_ceiling` while `rehype-slug` put `non_grid_row_ceiling` on the
anchor, so the entry rendered, was clickable, and silently went nowhere.

The underscore form is now its own flanking-aware rule and the asterisk rules
are left alone, because only `_` carries the intraword exemption — giving `*`
the same one would break `a*b*c`, which the renderer really does emphasise.
Underscore runs are matched whole (`(?<!_)` / `(?!_)`), which is what keeps
`x__init__y` literal, and a matched pair is dropped at whatever length it has,
since it contributes no characters to the rendered text however it nests.

The one-underscore case is a REGRESSION pin, not a repair: `## the snake_case
name` was already correct — a lone underscore has nothing to pair with, which
is why this went unnoticed for so long — and it still slugs
`the-snake_case-name`. It takes two or more underscores in one heading for the
old italic rule to find a pair.

One live heading in this repository's own docs was affected
(`packages/react/README.md:224`). Measured, not derived: the corpus sweep over
`content/docs/**` plus every `packages/*/README.md` — 223 files, 2941 rendered
headings — goes from 5 divergent files to 4, and the 4 that remain are a
different, already-filed defect (objectui#7666, a heading `extractToc` lists
that the renderer never emits under a JSX block). Pinned against the real
render pipeline rather than a second derivation of the flanking rule: each
heading is rendered through `MarkdownImpl` and `extractToc`'s id compared to
the `id` attribute `rehype-slug` actually emitted.
