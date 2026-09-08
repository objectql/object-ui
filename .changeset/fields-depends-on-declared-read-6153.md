---
'@object-ui/fields': patch
---

The option widgets and the lookup read `dependsOn` through the declared type.

`SelectField`, `MultiSelectField`, `RadioField` and `CheckboxesField` now read the
cascade key as `field.dependsOn` — `BaseFieldMetadata.dependsOn` — instead of
through an `as any`; `LookupField` reads both of its spellings (`depends_on`, then
`dependsOn`) through `LookupFieldMetadata`. Behaviour is unchanged: a select whose
metadata carries `dependsOn` still gates and prunes its options, a lookup still
scopes its candidate queries, and the metadata key still wins over the `dependsOn`
widget prop. What changed is that a wrong spelling or shape at the read site is now
a compile error rather than a silent no-op. objectui#6153.
