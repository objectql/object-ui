---
'@object-ui/fields': patch
---

`GeolocationField` renders a `0` coordinate as the place it is, and stops leaking a literal
`0` into the DOM (objectui#8055).

Two independent defects were live in the widget's **display/read** path, and fixing either
one alone left the other:

1. **A valid location displayed as empty.** Every presence test in the widget asked the
   parsed NUMBER whether it was falsy — `if (!loc.latitude || !loc.longitude)` — and `0` is
   falsy. So the equator (`latitude: 0`), the prime meridian (`longitude: 0`) and a perfect
   `accuracy: 0` all took the "no value" branch: the coordinates row showed the `EmptyValue`
   em dash, the accuracy row vanished, and "View on map" was withheld — including its
   `openInMaps` handler, which refused the same value a second time. The stored data was
   intact and unreachable.

2. **A literal `0` reached the DOM.** Three of those guards were JSX render expressions
   (`{location.latitude && location.longitude && (…)}`). With `latitude === 0` such an
   expression evaluates to `0`, and React renders the NUMBER as a text node. Measured on
   `main`, `{ latitude: 0, longitude: 120.1551 }` rendered `"—0"`: the em dash from defect 1,
   and a stray `0` beside it from defect 2.

Both are closed by one predicate that is nullish **and** boolean-valued — nullish so `0`
counts as present, boolean so no numeric operand can ever reach the DOM through `&&`.

**The delta is exactly `0` and `-0`.** The predicate excludes `NaN` just as the old falsy
guard did; a bare `!= null` would have started rendering `"NaN, NaN"` at a surface that has
always shown the placeholder for an unreadable coordinate. `Infinity`, `null`, `undefined`, a
missing half of the pair and a non-number all answer exactly as they did before.

**If you depended on the old rendering**, you were depending on a zero coordinate displaying
as no coordinate; nothing in this repo did (the sibling `LocationField` already pins the
opposite — a stored `{ lat: 0, lng: 0 }` renders `0, 0`). A `type: 'geolocation'` record
holding a zero now shows its coordinates, its accuracy row and its map link.
