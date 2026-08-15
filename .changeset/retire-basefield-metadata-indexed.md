---
'@object-ui/types': minor
---

Remove `BaseFieldMetadata.indexed` — the ObjectStack spec has no field-level
index flag

`indexed` was never a `FieldSchema` key. The field-level flag built no index
(objectstack#2377 removed it) and, since objectstack#4001 replaced silent
drops with loud rejection, `FieldSchema.safeParse` refuses it by name. PR
#4675 already removed the designer-side declaration
(`DesignerFieldDefinition.indexed`) and retired the Studio control that wrote
it; this was the *other* declaration of the same dead key, on the
renderer-side field-metadata type (`BaseFieldMetadata`, the type
`FieldWidgetComponentProps.field` resolves to). Measured on current `main`:
zero readers and zero writers anywhere in `packages/*/src` or `apps/*/src`
outside of an unrelated "0-indexed" prose comment.

Declare indexes on the object instead: `indexes: [{ name, fields, unique }]`.
