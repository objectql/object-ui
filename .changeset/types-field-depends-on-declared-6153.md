---
'@object-ui/types': minor
---

`dependsOn` is now a declared member of the field-metadata face.

`BaseFieldMetadata` gains `dependsOn?: FieldDependsOn`, the spec's field-level
cascade key in the spec's own shape — derived from `@objectstack/spec/data`'s
`Field` by reference: an array of controlling field names, or `{ field, param }`
entries. Every field type inherits it, so an annotated `SelectFieldMetadata` or
`LookupFieldMetadata` literal can now carry the key the running widgets have
honoured all along; before, the excess-property check refused it and the widgets
reached it through an `as any`. A bare parent name is refused at the type, as the
spec refuses it at publish (`invalid_type`) — that shape belongs to the form-level
`FormField.dependsOn` and to the `dependsOn` widget prop. `FieldDependsOn` is
exported.

The snake_case `depends_on` stays declared for now: it is objectui's legacy twin,
never a spec key, and retires on its own card (objectui#7357). Maintainer ruling A
on objectui#6153.
