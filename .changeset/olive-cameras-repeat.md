---
"@object-ui/plugin-map": patch
---

`ObjectMap`: make the marker `useMemo` actually memoize.

`getMapConfig(schema)` ran unmemoized in the render body, so `mapConfig` carried
a fresh object identity on every render. The marker transform names `mapConfig`
in its dependency array, so it recomputed on every single render — walking every
record through `extractCoordinates` and the display-name resolver, and re-running
`ObjectMapConfigSchema.safeParse` on each pass — while declaring that it does not.
The invalidation cascaded on into `filteredMarkers`, `clusteredData`,
`markerBounds` and `initialViewState`.

`mapConfig` is now memoized on `schema`, the one value `getMapConfig` reads.
Behaviour is unchanged; the config is still rebuilt whenever the schema
genuinely changes.
