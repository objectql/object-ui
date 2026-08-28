---
'@object-ui/fields': minor
---

**BREAKING (stored data): `LocationField` reads and writes the spec's `{ lat, lng }`**

FROM — the widget read `value.latitude` / `value.longitude`, each behind `|| 0`, and emitted
`{ latitude, longitude } | null`.

TO — it reads and writes `LocationValue` from `@objectstack/spec/data`
(`{ lat, lng, altitude?, accuracy? }`), re-exported here rather than re-declared, and reads
nothing else. A pair is read only when BOTH `lat` and `lng` are finite numbers.

**The behaviour change, stated plainly:** a `type: 'location'` record stored in the retired
`{ latitude, longitude }` spelling — including one this widget itself wrote before this
release — now renders **EMPTY in the edit surface**, where it used to render its
coordinates. It keeps rendering correctly in detail views, list cells and on the map, which
read `lat`/`lng` first. Re-saving the record through this widget, or fixing the value at the
data layer, restores it. There is deliberately **no compatibility fallback**: the maintainer
ruled the bare flip (2026-08-28, objectui#6272 option A1) explicitly over a dated read-side
shim, choosing zero dialect over softening this cost.

Marked `minor` per AGENTS.md §版本号策略 (this repo never publishes `major` outside an
`@objectstack` major sync); the break is real and is stated here.

**Why the widget was the side that moved**

`@objectstack/spec@17.2.0` exports `LocationValue = { lat, lng, altitude?, accuracy? }` as
the canonical stored shape and deprecates `LocationCoordinates` (`{ latitude, longitude }`).
Measured through the contract itself, `valueSchemaFor({ type: 'location' })` **rejects**
`{ latitude, longitude }` with `invalid_type` at `[lat]` and `[lng]`, and **accepts**
`{ lat, lng }`. So this widget was the one `location` surface producing a shape the
platform's own validator refuses, and `LocationCellRenderer` / `ObjectMap` reading
`lat`/`lng` first is correct by contract, not tolerance.

The user-visible defect it fixes: a spec-canonical `{ lat, lng }` record rendered **`0, 0`**
in the edit box — not an error state but a valid coordinate in the Gulf of Guinea — while
the same record rendered correctly one panel away. The `|| 0` defaults are gone with the
rename, so a half-stored pair (`{ lat }` alone) no longer invents the coordinate it is
missing; it reads as unset. A stored `{ lat: 0, lng: 0 }` still renders `0, 0`, because that
is now the only way those digits can appear.

`GeolocationField` is **not** part of this change: `geolocation` is not a member of the
spec's closed `FieldType` union and its value schema accepts both spellings, so it keeps its
own `{ latitude, longitude }` shape.
