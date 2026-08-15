---
'@object-ui/app-shell': minor
'@object-ui/plugin-designer': minor
'@object-ui/types': minor
'@object-ui/i18n': minor
---

Retire the field designer's `Indexed` toggle — the ObjectStack spec has no
field-level index flag

`indexed` was never a `FieldSchema` key. The field-level flag built no index
(objectstack#2377 removed it) and, since objectstack#4001 replaced silent
drops with loud rejection, `FieldSchema.safeParse` refuses it by name. Ticking
`Indexed` in Studio therefore made `PUT /api/v1/meta/object/:name` fail with
`422 INVALID_METADATA`, and — because the key was stored — every later save of
that object stayed blocked until the author found and cleared the toggle.

Both field designers stop offering the control and stop authoring the key
(`ObjectFieldInspector`'s Advanced section; `FieldDesigner`'s advanced
section, `MetadataFieldsPage`, `MetadataService`, `metadataConverters`), the
`designer.field.indexed` / `appDesigner.fieldDesigner.indexed` labels retire
with it across all ten locale packs, and `DesignerFieldDefinition.indexed` is
removed from `@object-ui/types`.

Drafts and objects that already carry the key are un-poisoned on load rather
than migrated, so an edit-and-save round-trip of previously blocked metadata
now succeeds. The strip is keyed to the retired key alone — every other
unknown key on a field definition still survives the round-trip.

Declare indexes on the object instead: `indexes: [{ name, fields, unique }]`.
