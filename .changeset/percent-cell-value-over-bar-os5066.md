---
"@object-ui/fields": patch
---

`percent` / `progress` cells now give the NUMBER shrink priority over the decorative bar (objectstack#5066)

In a narrow clipping container the percent display renderer sacrificed the wrong
half of itself. It emitted a `w-16 shrink-0` bar in front of a shrinkable value
span, so in a `record:highlights` chip — `basis-[9rem]`, shrinking toward
`min-w-[7rem]` as chips are added, clipping with `truncate` — the 64px bar plus
the 8px gap consumed the content box and `truncate` removed what was left of the
value. A stored `33.33` carried `33%` in the DOM and read as `3` on screen
(measured: 79px clip box, 32px text node, 25px overflow), with no ellipsis and
nothing in the accessible name to signal the loss: a silently smaller, plausible
number rather than a cosmetic glitch. Downstream the app had to override the
highlight's render type to `number` to get its digits back, losing the `%` glyph
and the bar entirely.

The priority is now inverted, on the principle that the number is the CONTENT and
the bar is DECORATION: the value span is `shrink-0` and the bar carries
`min-w-0 shrink`, keeping `w-16` only as its PREFERRED width, so a squeezed
container eats the bar and the digits survive intact.

The bar is deliberately NOT `flex-1`. `flex-1` would let it GROW as well as
shrink, stretching the bar across every wide grid cell and changing a surface
that has no bug; `w-16` stays the upper bound, so wide containers render exactly
as before and only the shrink direction changed. Below roughly 40px of content
the bar has collapsed to nothing and the value clips like any other single-line
cell — same floor as the plain number renderer, which is as far as a
self-contained renderer fix reaches (the chip's own width is a function of how
many chips the record has, so the strip's `@container` cannot see it).

The neighbouring `number` renderer is untouched.
