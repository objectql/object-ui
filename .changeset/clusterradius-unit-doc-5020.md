---
'@object-ui/plugin-map': patch
---

`ObjectMapProps.clusterRadius`'s JSDoc said "in pixels"; `clusterMarkers` has
always used it as a coordinate-degree grid cell edge (`radius / 2 ** zoom`,
divided into the marker's `[lng, lat]` degrees), not a screen-space radius —
a host tuning clustering granularity by the documented unit would get a
completely different result than intended (objectui#5020).

No behavior, default, or name changes: clustering, the >100-visible-marker
auto-threshold, and tap-through zoom are unaffected, and `clusterRadius` has
no call sites outside `plugin-map/src` today (re-confirmed repo-wide,
including `apps/`, `examples/`, and the `objectstack` spec/server repo — the
default of `50` is what runs everywhere). This is a doc-comment correction
only, bringing the JSDoc in line with the README's already-correct wording
(post objectui#5002).

The latitude-anisotropy trade-off (a degree grid distorts east-west as
latitude rises) is a known design trade-off, not part of this fix.
