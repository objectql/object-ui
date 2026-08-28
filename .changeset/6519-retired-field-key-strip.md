---
'@object-ui/app-shell': patch
---

The object designer's field-IO read door now strips `referenceTo` and `isSystem` alongside
`indexed`, so a draft authored before those controls were retired can be edited and saved
again (objectui#6519).

`previews/object-fields-io.ts` is the single read door for `draft.fields` across the whole
object designer — inspector, form designer, design surface, settings / validations / API
panels — and `writeFields` writes each def back verbatim. Its strip set named one key while
`FieldSchema` refuses five by name, so a stored field carrying any of the others
round-tripped straight back out to `PUT /api/v1/meta/object/:name`. Measured on the
installed `@objectstack/spec` 17.2.0, through the whole document that endpoint validates:

```
ObjectSchema.safeParse({ name:'account', label:'Account',
                         fields: { amount: { type:'number', label:'A', referenceTo: 1 } } })
  => unrecognized_keys at ["fields","amount"]
```

which is the hard `422 INVALID_METADATA` that blocks EVERY later save of that object, with
the control that wrote the key retired and no UI path left to clear it. This is the shape
objectui#4644 closed in this same file for `indexed`, applied to the siblings that were
left open.

Both added keys were verified to be reachable rather than assumed: `referenceTo` was
emitted by both designer writers until objectui#6041 (`MetadataService.toFieldPayload` and
`MetadataFieldsPage.fromDesignerField`), and `isSystem` was a declared server-field key the
designer read back until objectui#6044. Neither loses anything — the spec spellings
`reference` and `system` are separate, accepted keys and ride through untouched.

Two keys `FieldSchema` also refuses are deliberately NOT stripped, each for its own
measured reason, and the tombstone on `RETIRED_FIELD_KEYS` carries both in full:

- `formula` (objectui#6043) — `ObjectFieldInspector` seeds its linting CEL editor from
  `def.expression ?? def.formula` and the first edit commits `expression` and clears the
  alias. Stripping at the read door empties that editor and the authored source is gone on
  the next save; objectui#6043 refused a blind rename precisely because that migration
  surface exists. Dropping the text anyway is a maintainer call, raised on objectui#6519.
- `sortOrder` (objectui#6045) — no writer on this tree ever populated a FIELD-level one, so
  no draft this door reads can carry one; a strip would be dead code that reads like a
  measurement.

Unifying the three retired-key lists on this seam is deliberately not part of this change:
it spans `plugin-designer/src/MetadataFieldsPage.tsx`, which objectui#6489 owns in flight.
