---
"@object-ui/plugin-charts": minor
---

Dashboard chart widgets no longer render as a blank area when their height class
resolves to `auto`.

`ChartContainer`'s min-size fallback was applied only to the wrapper `div`.
Recharts measures its own `width:100%;height:100%` size-detector element, and a
percentage height never resolves against an ancestor's `min-height`, so the
wrapper obediently grew to 280px while the measured element stayed at 0 — and
Recharts renders no children at all for a non-positive box. The result was a
widget card with its title over an empty chart area: no marks, no refusal, no
empty state, and permanent, because a box that never changes fires no resize.
The floor is now applied to the measured element as well, under the same
condition, so an author's explicit height still wins.
