---
'@object-ui/app-shell': patch
---

`MetadataService.saveFields` carries the server's per-FIELD keys through a field save
instead of rebuilding every entry from the designer model (objectui#6488).

The method preserved unknown keys of the OBJECT document by spreading it, but that spread
is object-level and said nothing about keys INSIDE a field. Every entry was rebuilt by
`toFieldPayload`, so every key the server sent inside a field that the designer does not
model was dropped on every field save: `expression` (a formula authored in metadata-admin),
`precision`, `scale`, `system`, `sortable`, and anything a plugin registered. Measured
against the installed `@objectstack/spec` 17.2.0, `FieldSchema` accepts all five — the
designer's model is a subset of what a field may hold, and the difference was being
deleted.

The loss is not new but was UNREACHABLE. While `fields` went out as an array the whole
body was refused `422 INVALID_METADATA` before persistence, so nothing `saveFields`
dropped ever reached storage; objectui#6240 made the body parse, and a PUT is an upsert,
so from that fix onward the drop lands.

`toFieldPayload` now merges onto the previous SERVER entry, read from the document
`saveFields` already fetches for the object-level spread — the form
`MetadataFieldsPage.fromDesignerField` has used one writer over all along, and no extra
request.

Two properties keep the fix from becoming its own mirror image, both pinned in
`MetadataService.fieldKeyCarryOver.test.ts`:

- **A property the author CLEARED stays cleared.** Every modelled key is still written
  unconditionally, so a cleared property arrives as an explicit `undefined` that overrides
  the carried value and is dropped by `JSON.stringify` — absent from the body, which on an
  upsert is the deletion. A conditional merge would leave the server's old value standing
  and fail the author's deletion silently.
- **Retired designer keys do not ride back out.** `indexed`, `referenceTo`, `formula`,
  `isSystem` and `sortOrder` are refused BY NAME by `FieldSchema`; a stored document can
  still carry them, and echoing one back is a hard 422 that blocks every later save of the
  object with no UI path to clear it. Everything else the server sent still survives — the
  strip is keyed to those tombstones, not a blanket unknown-key purge.
