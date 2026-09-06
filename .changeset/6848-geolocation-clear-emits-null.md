---
'@object-ui/fields': minor
---

`GeolocationField` emits `null` for a cleared coordinate, not `undefined` (objectui#6848).

Emptying a latitude or longitude box now emits `{ …, latitude: null }` where it previously
emitted `{ …, latitude: undefined }`. `CurrencyField`, `PercentField` and `NumberField` all
already emitted `null` for the identical user action, and `LocationField` emits `null` too —
this composite was the only widget of the class that did not.

**Why `undefined` was the wrong sentinel.** It cannot survive serialization: `JSON.stringify`
drops an `undefined`-valued key outright, so the moment the emission left memory it stopped
saying "the user cleared this" and started saying nothing at all. `null` says it explicitly and
keeps saying it on the wire.

**Scope — what this is NOT.** The card was filed on the reasoning that the dropped key reaches
a PATCH-shaped update as an ABSENT key, which conventionally means "leave this field alone",
so a cleared coordinate would silently fail to persist. That was measured before this fix was
chosen, and the second half does not hold for this widget: the dropped key is nested one level
below the key the write path merges on. The request body still carries the composite's own key
(`{ <field>: { longitude: … } }`), a `location` value is stored as a single JSON column, and
nothing on the path deep-merges — so the whole value is replaced and the cleared coordinate
does not come back. No silent data loss was found, and none is fixed here. What is fixed is
the emission: a widget that could not express "cleared" in a form that survives serialization,
in a class whose other members could.

**`GeolocationValue` widened** — `latitude`, `longitude` and `accuracy` are now
`number | null | undefined`. `undefined` stays admissible, because an untouched coordinate is
genuinely absent; `null` is now admissible because a cleared one is explicitly empty. Code that
reads these coordinates with a falsy or `== null` test is unaffected. Code that distinguishes
`=== undefined` specifically will now see `null` after a user clears a box.

A legitimate `0` coordinate (the equator, the prime meridian) is unaffected and is now pinned:
the emptiness test reads the raw input string, and `'0'` is not an empty string.
