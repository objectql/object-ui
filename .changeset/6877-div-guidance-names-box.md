---
'@object-ui/components': patch
---

Rewrite the `div` deprecation guidance so it names `box`, the one replacement measured drop-in.

The notice and the machine-readable `deprecated.replacement` recommended `card` / `flex` /
`container` / `stack` / `grid` for the plain-wrapper case. Measured through the real renderer,
each of those injects classes of its own, `card` also moves the children into an extra element,
and four of the five read `children` only — so a node authoring `body` loses its content
silently, at an unchanged element count. `box` (objectui#3965) is the class-transparent swap and
was never mentioned. Deprecation guidance is followed literally, so the old text manufactured
exactly the conversions objectui#3965 measured and rejected.

Both statements now name `box` first for the mechanical swap, keep the layout components for the
cases where their layout is actually wanted, and state the `body` → `children` move that every
option except `card` requires. `span`'s guidance is deliberately unchanged.
