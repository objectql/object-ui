---
'@object-ui/plugin-designer': patch
---

The field designer now reads the system-field marker under the spec's spelling `system`,
and never hands `isSystem` back to the metadata API (objectui#6044).

`isSystem` is not in `FieldSchema`'s accept set. Measured against the installed
`@objectstack/spec` 17.2.0:

```
FieldSchema.safeParse({ type: 'text', label: 'L', isSystem: true })
  => success = false
  => unrecognized_keys keys=["isSystem"]  "Did you mean `isSystem` -> `system`?"
```

Two defects, one misspelling, and they are two different sites.

**The read was dead** — the quieter and worse half. `toDesignerField` read `raw.isSystem`
while a spec-parsed server sends `system`, so the flag was always `undefined`. Nothing went
red, because the flag is optional and `undefined` is a valid "not a system field". But it is
load-bearing: `FieldDesigner` refuses to delete a system field and disables its name and
type inputs, so with the read dead `organization_id`, `created_at` and friends presented as
ordinary editable, **deletable** business fields.

**The write had no emit site at all.** `fromDesignerField` never names `isSystem`; its only
route out is the verbatim `...carryOver(prev)` spread, so a stored misspelling round-tripped
back to `PUT /api/v1/meta/object/:name` as a hard 422 `INVALID_METADATA` that blocks every
later save. The repair is a `RETIRED_FIELD_KEYS` tombstone rather than a renamed line — and
it is deliberately paired with the read fix, never a substitute for it: stripping alone would
close the 422 and fossilize the dead detection. The spec spelling `system` is not stripped,
so a server-injected flag rides through untouched and feeds the read.

`app-shell`'s `FieldMetadataPayload` never declared the key, so `toFieldPayload` had nothing
to fix. The designer's in-memory `DesignerFieldDefinition` keeps `isSystem`: it reaches no
wire-bound shape and the parity gate classifies it as `uiOnly`.
