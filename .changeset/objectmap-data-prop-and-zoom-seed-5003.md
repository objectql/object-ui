---
"@object-ui/plugin-map": patch
---

Fix two pieces of `ObjectMap` state that stopped tracking their source after mount
(objectui#5003):

- **`data` prop threading**: the fetch effect preferred records passed via `props.data`,
  but `data` was read off the `rest` spread and was not one of the effect's dependencies.
  A host rendering `<ObjectMap data={[]} .../>` while its own query is in flight, then
  re-rendering with the resolved rows, kept showing the empty map — the prop changed, the
  effect never re-ran to notice. `data` is now a declared prop (`data: dataProp`), tracked
  directly in the effect's dependency array; the whole `rest` object is intentionally
  **not** added there (it is a fresh object every render, which would refetch on every
  render instead).
- **Clustering zoom seed**: `currentZoom` — what `clusterMarkers` uses for its grid cell
  size — was seeded with a nominal `mapConfig.zoom || 3` and updated only by `onZoom`.
  MapLibre applies the initial camera (including a `bounds` fit) via its constructor,
  before react-map-gl attaches React's event handlers, so no `onZoom` ever fired for that
  first camera — the seed stayed nominal until the user's first zoom. It is now also
  seeded from `onLoad`, which fires once the initial camera has settled, so clustering at
  first paint reflects the camera MapLibre actually applied.

Both were dormant on the console path (never exercised in the example apps) — see the
issue for why — so this ships with dedicated tests exercising the prop-update path and
the pre-`onZoom` clustering state directly.
