---
---

Comment-only: `union-arm-diagnostics.ts` and its test state the size of
`AnyComponentSchema` as prose integers, and both had drifted (objectui#7702).
Nothing ships — no executable line changes, so no package is released by this
change.

The module's header said "108 leaf arms and 108 DISTINCT `type` literals" and
its display-cap argument said the cap "stops well short of the 108"; the
alignment fact said "14 entries for `AnyComponentSchema`'s 14 members". The
filer measured 105/103, and this branch measures 107 and 13 — three different
arm counts inside one week, in both directions.

The repair states the property instead of the count, per the ruling on the card:
what the cap argument actually rests on is that **no literal is claimed by two
arms** (which makes "exactly one arm accepts that literal" total), and the
alignment sentence needs no count at all. Those cannot go stale. Re-measuring
and re-stating the integers would only defer the next drift, so the numbers are
gone rather than refreshed, and no test pins them — a pinned count would red the
build every time a component lands.
