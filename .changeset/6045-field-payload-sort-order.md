---
'@object-ui/app-shell': minor
'@object-ui/types': minor
---

The field metadata payload no longer emits `sortOrder`, the key `FieldSchema` refuses by
name (objectui#6045). Field-level sibling of objectui#6223, same objectui#5761 family.

Measured against the installed `@objectstack/spec` 17.2.0, whose `FieldSchema` accept set
is 71 keys:

```
FieldSchema.safeParse({ type:'text', label:'L' })                  => success = true   (control)
FieldSchema.safeParse({ type:'text', label:'L', sortOrder: 3 })    => unrecognized_keys ["sortOrder"]

FieldSchema.safeParse({ type:'text', label:'L', sortable: true })  => success = true   (control)
FieldSchema.safeParse({ type:'text', label:'L', sortable: 3 })     => success = false
```

The control is what makes that a key-by-key result rather than a schema refusing
everything, and the `sortable` pair is what shows the near-spelling is a *different
concept* — a boolean ("whether field is sortable in list views"), not this key's spec
name.

**The resolution was deletion, not a rename**, which is objectui#4687's shape rather than
objectui#6041's. The spec has no field-level ordering key at all: it models field order by
**declaration order** in the object's `fields` record, so a designer that wants explicit
ordering reorders that record rather than carrying an index. There was nothing to map onto,
and nothing was invented to map onto.

**It was latent, and that is confirmed on today's tree.** Neither of the two sites that
construct a `DesignerFieldDefinition` — `FieldDesigner`'s create/update handlers and
`MetadataFieldsPage.toDesignerField` — ever named the key, so `toFieldPayload` emitted
`sortOrder: undefined` and `JSON.stringify` dropped it. The key never reached the wire. It
was one reorder feature away from doing so, which is the objectui#4644 shape: a hard 422
`INVALID_METADATA` that blocks every subsequent save of the object, with nothing in the UI
to say which key caused it.

Removed in one go from the wire shape (`FieldMetadataPayload`), its writer
(`toFieldPayload`) and the UI model (`DesignerFieldDefinition`), so no declaration is left
behind that no writer fills and no schema accepts.

**Breaking for TypeScript consumers**: `sortOrder` is gone from `DesignerFieldDefinition`
(`@object-ui/types`) and from `FieldMetadataPayload` (app-shell), so code that set either
stops compiling.

Two keys share this spelling and are untouched, which is why the census was on the *shape*
— a field-metadata payload key `FieldSchema` refuses — rather than on the identifier: the
**object-level** `sortOrder` (`ObjectSchema`'s, removed from the object wire shape by
objectui#6223 and deliberately kept on the `ObjectDefinition` UI model) and the
**saved-view** `sortOrder` in `ObjectView`, which is per-view display order on a different
document entirely.

The `KNOWN_UNPARSEABLE_KEYS` entry in `scripts/check-designer-field-key-parity.mjs` goes
with the fix — that ledger ratchets in both directions, so an entry left behind for a
resolved key is as red as a missing one.
