---
---

Comment-only: `InterfaceListPage`'s marker-title docblocks described the
`getRecordDisplayName` precedence ladder as containing an object-level
`titleField` rung. That rung was a second `??` leg inside step 0 and was deleted
in objectui#6531 (`@objectstack/spec`'s object schema is a `strictObject` that
rejects the key with `unrecognized_keys`), so the prose now names the rungs the
resolver actually has: `options.titleField` at step 0, the declared `nameField`
and its `displayNameField` alias at 1/2, the legacy `titleFormat` template at 3,
and the type-aware derivation at 4. No published behaviour changes.
