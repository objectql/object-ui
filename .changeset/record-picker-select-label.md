---
"@object-ui/fields": patch
---

The lookup "Browse all records" Record Picker now formats its columns with
the same field metadata the list view uses (objectui#3333). Previously the
dialog handed cell renderers a bare `{ name, type }` descriptor, so a
`select` column had no `options` and fell back to title-casing the raw
stored value (`manufacturing` rendered as "Manufacturing" instead of the
authored option label, e.g. "03 制造") — while the same field displayed
correctly in the list view and on the record detail page.

`RecordPickerDialog` gains an optional `fieldsMeta` prop (the referenced
object's schema `fields` map). When provided, each column's field descriptor
is enriched from the schema — `options` (run through the shared i18n option
translation), `currency`, `scale`, `precision`, `format`, `reference_to`, … —
and columns authored as plain strings in `lookup_columns` inherit the schema
field's `type`, so they format identically to typed columns. `LookupField`
passes the referenced object's schema it already fetches for `titleFormat`.
Callers that don't pass `fieldsMeta` keep the previous behavior.
