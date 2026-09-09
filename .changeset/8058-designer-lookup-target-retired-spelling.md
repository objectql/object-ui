---
"@object-ui/plugin-designer": patch
---

fix(plugin-designer): read a lookup's target under the retired `referenceTo` spelling too

`MetadataFieldsPage`'s read door (`toDesignerField`) read the spec spelling
`reference` and nothing else, while its carry-over strips `referenceTo` from the
stored definition. A field whose target survives only as the pre-objectui#6041
`referenceTo` therefore read as target-less, the strip removed the stored value,
and the field reached the wire as a `lookup` with no target — saving silently at
`@objectstack/spec` 17.2.0 and answering `422 INVALID_METADATA` at
`fields.NAME.reference` against 17.3.0, with nothing naming which field.

The read door now reads `reference` and falls back to `referenceTo`. That is a
pure rename: `FieldSchema`'s own alias map renames `referenceTo` onto
`reference` and both spellings carry one object machine name, so no value
changes shape on the way through — unlike the `formula` alias, where the rename
was refused because the two sides carry different value grammars
(objectui#6043).

objectui#7714's guard is untouched and still refuses a relationship field with
no usable target under either spelling, by name, before the PUT.
