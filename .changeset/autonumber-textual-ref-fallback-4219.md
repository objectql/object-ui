---
'@object-ui/plugin-detail': patch
---

Inline edit no longer offers a record picker for a spec-spelled `autonumber` field that carries a `reference_to`

`TEXTUAL_REF_FALLBACK_TYPES` — the detail page's one definition of "machine-computed" — spelled the auto-number type `auto_number` only. `@objectstack/spec`, the designer and the metadata importer all spell it `autonumber`, and the set is matched by RAW spelling, so it carried half the type.

The reader that had no gate in front of it is `InlineFieldInput`'s reference fallback, `!!field.reference_to && !TEXTUAL_REF_FALLBACK_TYPES.has(type)`, on exported public API. A field typed `autonumber` keeps a `reference_to` for relational metadata — which is the entire reason this set exists — so it took the lookup branch and rendered the RECORD PICKER: a searchable list of records offered as replacements for a machine-generated identity. The `auto_number` spelling of the identical field rendered the textual fallback, as intended. Both spellings are now members, matching how `plugin-form` carries both in each of its non-input sets.

The editability half of the same report (objectui#4219) was already closed from another direction by #4228, whose shared exclusion resolves aliases before matching — a field typed `autonumber` offers no inline affordance in either host. The two gates are a union, so this fix also removes the union's dependence on which spelling the metadata happens to use: previously `autonumber` was held by the exclusion gate alone and `auto_number` by both, and losing either gate would have re-opened a different half of the defect depending on how the field was authored.

Pins land with it: the reference fallback for `autonumber` (red before this change — the picker really did render), `auto_number` and a real `lookup` as controls in both directions, and set membership asserted directly so the union statement is checked rather than described.
