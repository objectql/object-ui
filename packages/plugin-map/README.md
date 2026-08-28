# @object-ui/plugin-map

Map view plugin for Object UI.

Renders the records of an **ObjectQL query** as markers on a MapLibre map: every
marker comes from a record's own coordinate fields, and the first paint frames the
records that were fetched. It is a *view over data* — there is no authored marker
list, and no pin you place by hand.

Importing the package registers two component types on the `ComponentRegistry`,
both resolving to the same renderer:

- `object-map` — the object-bound renderer
- `map` — the bare spec view-type name (`ViewTypeSchema`'s `'map'`), for a node
  authored with it directly. Inside an `ObjectView`, a `map` view is compiled to
  an `object-map` node, so both spellings end at the same component.

## Installation

```bash
pnpm add @object-ui/plugin-map
```

## Requires a bundler — plain Node cannot import this package

`ObjectMap` imports MapLibre's stylesheet at module scope
(`import 'maplibre-gl/dist/maplibre-gl.css'`), and Node has no loader for `.css` at all.
Importing the published entry from plain Node ESM — no bundler, no loader hooks — therefore
resolves and then fails during evaluation:

```text
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"
  for .../maplibre-gl/dist/maplibre-gl.css
```

**This is a supported-configuration statement, not a bug to report.** Unbundled Node
consumption is not supported for style-carrying plugin packages. It was ruled that way on
[objectui#5384](https://github.com/objectstack-ai/objectui/issues/5384) — deliberately, over
the alternative of moving the stylesheet out of module scope — because a MapLibre canvas
without its stylesheet is not a map, and no unbundled-Node consumer exists to serve.

Consume it through a host that handles CSS imports, which every supported host does: Vite,
webpack, or Next with the package listed in `transpilePackages`. If you have a real need to
import it under plain Node — SSR with no bundler, a Node-side script — please open an issue.
That reopens the question as a design decision rather than a defect, and the shape of your
consumer is the missing input.

## Usage

Registration is a side effect of the import. There is no manual-registration
export to iterate over — the import *is* the registration.

```ts
import '@object-ui/plugin-map';

// Object-bound: the markers are the records the query returns.
const schema = {
  type: 'object-map',
  objectName: 'stores',
  map: {
    latitudeField: 'lat',
    longitudeField: 'lng',
    titleField: 'name',
    descriptionField: 'address',
  },
};
```

A literal record array instead of a query, with the same `map` block:

```ts
const schema = {
  type: 'object-map',
  staticData: [
    { id: 1, name: 'San Francisco HQ', lat: 37.7749, lng: -122.4194 },
    { id: 2, name: 'Oakland Office', lat: 37.8044, lng: -122.2711 },
  ],
  map: { latitudeField: 'lat', longitudeField: 'lng', titleField: 'name' },
};
```

`filter` and `sort` are the **query's** filter and order — they reach the data
source as `$filter` / `$orderby`, and the spec's per-element `dataSource` binding
is honoured as well. The map issues no row cap of its own.

## The `map` block

The declared configuration input. Every key is optional:

| Key | Description |
| --- | --- |
| `latitudeField` | Record field holding the latitude. Needs `longitudeField` alongside it; both values must be numbers. |
| `longitudeField` | Record field holding the longitude. |
| `locationField` | Single field holding both coordinates — see the formats below. Used when the lat/lng pair yields nothing. |
| `titleField` | Field shown as the marker title. Omitted, the title is resolved by the object's own record-title precedence (`@object-ui/core`'s `getRecordDisplayName`, ADR-0079): the declared `nameField`, its deprecated `displayNameField` alias, the legacy `titleFormat` template, a type-aware pick from the object's fields, then name-ish keys read straight off the record — the rung that answers when no object definition reached the view, as `staticData` and an inline `data` array never fetch one. `Record #<id>` is the floor; `Marker` is reached only by a record carrying no id at all. |
| `descriptionField` | Field shown under the title in the marker popup. |
| `zoom` | Zoom level. Declaring it opts this view out of the auto-fit (see below). |
| `center` | `[latitude, longitude]` — a two-number **tuple**, latitude first. Declaring it opts this view out of the auto-fit. |
| `style` | MapLibre style URL/spec, replacing the default public demo style. |

**The block replaces the field-name defaults, it is not merged with them.** With
no map configuration at all the component falls back to the field names
`latitude` / `longitude` / `location` / `description` — no title field, because an
unconfigured marker takes its title from the record-title precedence above rather
than from a guessed `name`; the moment a `map` block is present, only what it
declares is read. So `map: { titleField: 'name' }`
on its own names no coordinate field, places nothing, and renders an empty map
under the excluded-records notice — the defaults do not fill the gap.

## Initial camera

There is no default zoom and no default centre. With records to show and no
camera declared, the map **fits the records**: their bounding box, measured along
the shortest arc that contains them (so a set straddling the antimeridian is
framed across the line, not around the far side of the planet), with 48px of
padding and a city-scale zoom ceiling of 12 — a single record does not become a
rooftop view.

Two cases sit outside the fit:

- **Nothing placeable** (empty result, or no record yielding coordinates): the
  whole world, centred on `0, 0`.
- **A declared camera**: `zoom` or `center` in the `map` block wins and the fit is
  skipped. Declaring one half keeps the other derived — `zoom` alone is applied at
  the centre of the records, `center` alone at a continental zoom.

A `center` that is not a two-number tuple (the `{ lat, lng }` object form, say) is
rejected by the config schema, warned about in the console, and **not** adapted —
and it does not cost the view its fit.

## Coordinate formats

`locationField` reads any of:

```ts
{ location: { lat: 37.7749, lng: -122.4194 } }  // also latitude/longitude, lon
{ location: '37.7749,-122.4194' }               // "lat,lng"
{ location: [37.7749, -122.4194] }              // [lat, lng]
```

A record whose coordinates are missing, unparseable, or out of range (latitude
beyond ±90, longitude beyond ±180) is left off the map and counted in a notice
above it, rather than being silently dropped or rescued.

## What this component does not read

Keys that look plausible on a map schema but have no read site here: `markers`
(markers are records), `layers`, `height` (the container is a fixed responsive
height, 300px through 600px), `useGeolocation` (the map carries a
user-initiated "show my location" button instead), and per-marker `icon` /
`color` / `popup` styling. A `map` configuration stashed under `filter.map` — a
shape predating the `map` input — is no longer read either, and says so in the
console.

## Using `ObjectMap` directly

`ObjectMap` (the component), `ObjectMapRenderer` (the registered wrapper, for a
host that registers types itself) and the `ObjectMapProps` type are the package's
exports:

```tsx
import { ObjectMap } from '@object-ui/plugin-map';

<ObjectMap
  schema={{ type: 'object-map', objectName: 'stores', map: { latitudeField: 'lat', longitudeField: 'lng' } }}
  dataSource={dataSource}
  onMarkerClick={(record) => console.log(record)}
/>;
```

| Prop | Description |
| --- | --- |
| `schema` | The map schema — the keys above. |
| `dataSource` | Resolves the `object` provider. Not needed for `staticData` or an inline `data` array. |
| `className` | Classes for the wrapper around the map. |
| `data` | Records to render directly, bypassing the component's own fetch — the shape `ListView` passes when it already holds the rows. Tracked live: passing a new array after mount (e.g. once a host's own in-flight query resolves) updates the map. |
| `onMarkerClick` | Called with the clicked record. |
| `onRowClick` | Record click handler; takes priority over the `navigation` overlay. |
| `onEdit` / `onDelete` | Passing either adds that button to the marker popup (and to the mobile record sheet). |
| `enableClustering` | Forces clustering on; without it, clustering starts above 100 visible markers. |
| `clusterRadius` | Clustering granularity (default `50`): the grid cell is `clusterRadius / 2 ** zoom`, so a larger value groups more aggressively. |

In a schema-driven page these handlers may equally be authored on the node
itself: `SchemaRenderer` spreads a node's non-metadata properties onto the
component.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-map) — the full
  authoring reference for the schema and the `map` block
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-map)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
