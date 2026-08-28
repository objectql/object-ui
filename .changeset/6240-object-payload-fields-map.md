---
'@object-ui/app-shell': patch
---

`MetadataService`'s object writers PUT `fields` as the name-keyed MAP `ObjectSchema`
requires, not an array (objectui#6240). Both of the designer's write paths were affected,
and `saveFields` ran the conversion in the wrong direction outright: the server's own
document arrives with `fields` as a map, and `fields.map(toFieldPayload)` turned it into an
array on every field save.

Measured against the installed `@objectstack/spec` 17.2.0 and against the framework's own
write door. `ObjectSchema.fields` is a required record: an array — empty or not — is
refused `invalid_type @ fields`, a map parses. `metadata-protocol`'s `saveMetaItem`
resolves metadata type `object` to that same `ObjectSchema`, `safeParse`s the whole item
and throws `422 INVALID_METADATA` **before** persisting, so the array was refused rather
than stripped or stored: every designer object save and every designer field save that went
through this service was a 422 that wrote nothing.

This is the value-level half of the objectui#5761 parity family and is invisible to that
family's key-name gate — `fields` sits in the accept set under either shape, which is the
gate's own coverage note 4. The pins are runtime assertions on the captured request bytes.

The conversion refuses, loudly, what it cannot key: a field with a missing or blank `name`
throws instead of writing a `{ undefined: … }` entry (measured: the spec ACCEPTS that
document, so nothing downstream would have caught it), and a duplicate name throws instead
of letting the later field silently replace the earlier — a loss an array does not have.
`saveFields` keeps preserving unknown keys of the fetched server document, which now
actually reaches storage. `saveObject` with no `existingFields` still omits the key rather
than writing `{}`: a PUT is an upsert, so `{}` would delete every field of an object on a
save that only meant to rename it.

`saveObject(obj, existingFields)` keeps its `FieldMetadataPayload[]` parameter type — the
array is converted inside — so no caller's call site changes.
