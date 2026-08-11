---
'@object-ui/plugin-map': patch
---

`object-map` reads its configuration from the declared `map` input only — `filter` is the query filter, and a map authored with both stopped rendering markers

`getMapConfig` probed every filter for a `map` key and, on a hit, used it as the MapConfig: `schema.filter.map`, plus a `schema.filter.map.style` half in the style chain. That shape predates the `{ name: 'map', type: 'object' }` input both registrations declare, and it gave `filter` two meanings inside one block — the query filter at `$filter: schema.filter`, and a configuration slot.

The probe was written as `'map' in schema.filter`, and `in` walks the prototype chain. The ordinary filter is an **array**, and every array inherits `Array.prototype.map` — so the probe matched, handed the component a *function* as its map configuration, and the spread of a function is `{}`. The declared `schema.map` was never reached (it sat in the `else` branch), so a map authored with both `map` and `filter` — two documented inputs, no legacy shape required — lost `latitudeField` / `longitudeField` / `titleField`, failed `extractCoordinates` on every record, and rendered zero markers under a "N records with missing or invalid coordinates excluded from the map" banner. The only console output was `[ObjectMap] Invalid map configuration:` from the Zod parse of a function.

This was reachable two ways and both are fixed by the same deletion: an author writing `filter` alongside `map`, and the `dataSource` binding of objectstack#7121, whose merged filter is an `and` node — `['and', [...], [...]]`, still an array, still carrying `Array.prototype.map`.

Both legacy reads are gone; the map consumes only what it declares. The `map` config, the top-level `locationField` / `latitudeField` branch, and the `style` / `mapStyle` reads are untouched, and `filter` is passed to the query verbatim — a field genuinely named `map` still filters on it, and nothing is stripped from the author's filter.

A schema still carrying the legacy `filter.map` stash now gets a dev-mode warning naming the shape and pointing at `schema.map`, rather than silently falling back to the default field names. It is deliberately narrow: own properties only (so an inherited `map` method never triggers it) and object-valued only (so `filter: { map: 'x' }` reads as a filter on a field named `map`), and it warns once per distinct stash because `getMapConfig` runs on every render. Production behavior is unchanged beyond the configuration no longer being read.
