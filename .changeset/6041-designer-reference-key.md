---
'@object-ui/plugin-designer': patch
'@object-ui/app-shell': patch
---

The field designer now reads and writes a lookup field's relationship target under the
spec's spelling `reference` (objectui#6041), in both directions.

`referenceTo` is not in `FieldSchema`'s accept set. Measured against the installed
`@objectstack/spec` 17.2.0, through the whole object document that
`PUT /api/v1/meta/object/:name` validates:

```
ObjectSchema.safeParse({ …, fields: { rel: { type: 'lookup', label: 'Owner',
                                            referenceTo: 'user' } } })
  => success = false
  => unrecognized_keys at ["fields","rel"] keys=["referenceTo"]
     "Did you mean `referenceTo` -> `reference`?"
```

so authoring a lookup field through the designer returned a hard 422 `INVALID_METADATA`,
and — because the key is then stored — blocked **every subsequent save** of that object,
with nothing in the UI to say which key did it.

The read direction was broken symmetrically and is the half that would have survived a
write-only fix: `toDesignerField` read `raw.referenceTo` while a spec-parsed server sends
`reference`, so every already-saved lookup field loaded into the designer with an **empty
reference box**. Both wire-bound payload shapes move — `FieldMetadataPayload`
(`MetadataService.toFieldPayload`) and `ServerFieldSchema`
(`MetadataFieldsPage.fromDesignerField`).

`referenceTo` also joins `RETIRED_FIELD_KEYS`. Renaming the emit sites alone does not
unblock an object whose stored fields already carry the misspelling: `carryOver` spreads
the previous server def verbatim, so the key would ride straight back out to the same 422.
The designer's in-memory `DesignerFieldDefinition` keeps `referenceTo` — that is the
internal prop name every other UI surface in this repo already uses (`LookupField`,
`filter-builder`, `ObjectChart`, `ListView`, `UserFilters`), it reaches no wire-bound
shape, and the parity gate classifies it as `uiOnly` rather than a violation.

No behavioural change for a half-filled draft: the spec's prose calls `reference`
"required for relationship types", but that is not enforced by the zod parse at 17.2.0 —
`{ type: 'lookup', label: 'L' }` parses green at field level and through `ObjectSchema`,
and `undefined` is dropped by `JSON.stringify` under either spelling, so the wire bytes
are identical before and after.
