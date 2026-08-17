---
'@object-ui/plugin-map': patch
---

A map view now fits its camera to the records it queried, so a view with data never first-paints an empty viewport.

The initial camera was never derived from the data. The zoom came from
`getMapConfig`'s default branch — the branch reached precisely when the author
declared nothing — which synthesized `zoom: 10` at the origin, and the fabricated
value was indistinguishable from a declared one at the read site. An unconfigured
object list view of continent-wide records therefore opened on a ~30km-wide
viewport centred on the set's midpoint: no markers anywhere on screen, the
records reachable only by zooming out and panning by hand (objectui#4941, seen on
the showcase `task` map view, whose ten seeded US-city locations span ~4000km).

The camera is now the marker set's bounding box, handed to MapLibre as
`initialViewState.bounds` so the fit happens against the real container size,
with padding and a city-scale zoom ceiling (a single record, or several at one
address, fits a zero-width box — unbounded, that answers with a rooftop view of a
style whose tiles stop far short of it).

The box is measured along the **shortest arc** containing every marker, not
between the naive longitude extremes. Read as a line rather than a circle, two
records two degrees apart across the antimeridian (179 and -179) describe a
358-degree box whose centre is their antipode; MapLibre then places the markers in
whichever copy of the world is nearest their previous screen position, which is
how a fitted-looking camera ends up showing empty ocean with the records sitting
on a neighbouring copy.

Unchanged on purpose: record coordinates are not rescued. The platform's
`location` value bounds longitude to [-180, 180], so an out-of-range coordinate is
a producer-side defect — such records keep being rejected and counted in the
view's "invalid coordinates" notice, and the normalization above is camera
arithmetic over already-valid values. No new configuration key was added either:
the documented `zoom` / `center` pair of the `map` block is still the only camera
declaration, it still wins outright, and declaring one half keeps the other
derived (`zoom` alone applies at the records' centre; `center` alone at a
continental zoom). An empty result set is not fitted — it opens on the whole
world rather than a zoom-10 patch of sea.
