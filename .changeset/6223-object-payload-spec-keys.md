---
'@object-ui/plugin-designer': minor
'@object-ui/app-shell': minor
---

Object-level metadata payloads no longer emit the three keys `ObjectSchema` refuses by
name — **group**, **sortOrder** and **relationships** (objectui#6223).

Measured against the installed `@objectstack/spec` 17.2.0, whose `ObjectSchema` accept set
is 42 keys:

```
const base = { name: 'account', label: 'Account', fields: { n: { type: 'text', label: 'N' } } };

ObjectSchema.safeParse(base)                              => success = true    (control)
ObjectSchema.safeParse({ ...base, isSystem: true })       => success = true    (control)
ObjectSchema.safeParse({ ...base, pluralLabel: 'A' })     => success = true    (control)

ObjectSchema.safeParse({ ...base, group: 'Sales' })       => unrecognized_keys ["group"]
ObjectSchema.safeParse({ ...base, sortOrder: 3 })         => unrecognized_keys ["sortOrder"]
ObjectSchema.safeParse({ ...base, relationships: [ … ] }) => unrecognized_keys ["relationships"]
```

The two controls are what make that a key-by-key result rather than a schema refusing
everything. Each key was resolved on its own, as the objectui#5761 family ruling requires:

- **group** — the Object Manager's grouping is a UI-only display category. The spec has no
  object-level grouping key (`fieldGroups` groups the fields *inside* one object), so the
  grouping control and its column stay, and the value is now DERIVED from the spec key that
  is accepted (`isSystem`) instead of round-tripped. `MetadataObjectsPage` also strips a
  `group` already stored by an earlier build, because its save-back spreads the server
  document verbatim and would otherwise keep re-sending it forever.
- **sortOrder** — what populated it was the array index the converter happened to be at,
  i.e. the order the list was already in. The declaration is removed from the object
  payload. The field-level `sortOrder` is a different key with a different card
  (objectui#6045) and is untouched.
- **relationships** — the spec models relationships on the FIELD (`reference` /
  `master_detail`, plus object-level `indexes`). The object payload stops declaring and
  sending an object-level relationship array; what the designer should author for a
  relationship is a data-model question this change does not settle.

**Breaking for TypeScript consumers of `ObjectMetadataPayload`** (exported from app-shell):
the three properties are gone from the published type, so code that set them stops
compiling. That is the point — setting any of them produced a payload the metadata route
refuses. `ObjectDefinition` (the designer's UI model) is unchanged and still carries all
three.

The parity gate built for objectui#5761 now has a **second oracle**: every shape in
`PAYLOAD_SHAPES` names the schema that judges it, `ObjectSchema` alongside `FieldSchema`,
and reach is resolved within an oracle rather than across one — `group` is a legal
`FieldSchema` key and a refused `ObjectSchema` key at the same time. That extension found a
fourth object-level key (`enabled`, objectui#6238) and a value-level rejection the key-name
check cannot see (`fields` sent as an array where the spec wants a map, objectui#6240);
both are filed and ledgered rather than fixed here.
