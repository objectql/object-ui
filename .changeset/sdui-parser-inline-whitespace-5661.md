---
'@object-ui/sdui-parser': patch
---

`kind:'html'` page sources keep the space between a text run and an adjacent
inline element: `A <strong>x</strong> page` now compiles to `A `/`<strong>`/`
page` and renders as `A x page` rather than `Axpage` (objectui#5661).

The parser collapsed each text run's whitespace to a single space — correct, and
what HTML itself does — and then `.trim()`ed it, which is not: HTML collapses a
whitespace run to one space, it does not delete it. The deleted space was
precisely the separator between a run and its inline sibling, so every authored
sentence carrying emphasis or a link in the tier the guide recommends by default
rendered with its words run together. It was silent: the page rendered, the
structure was right, no diagnostic fired.

The rule is deliberately mechanical rather than a block/inline taxonomy invented
for a schema tree that has none: keep one leading space when a sibling precedes
the run, and one trailing space when a sibling element follows it. The parent's
own start and end still drop their edge space, so `<p>  hi  </p>` is unchanged.

Its one bounded cost: a whitespace-only run BETWEEN two siblings survives as a
single space, so a pretty-printed `<ul>` gains one `' '` string child per gap
between its `<li>`s — one space per gap, never the source's newline and
indentation, never at the container's own edges, and never inside an item's own
text. That bound is pinned by a test rather than left as a claim.
