---
"@object-ui/types": minor
"@object-ui/fields": minor
"@object-ui/app-shell": minor
"@object-ui/plugin-grid": patch
"@object-ui/components": patch
---

**Removed `depends_on` from field metadata. Rename it to `dependsOn`.**

FROM `depends_on` → TO `dependsOn`, on field-metadata documents. Nothing is
renamed for you and there is no transition period: metadata that still spells the
key the old way no longer gates a dependent lookup and no longer scopes its
candidate query. It is silently inert, not an error.

`depends_on` was objectui's own snake_case twin of `@objectstack/spec`'s
field-level `dependsOn`. It was never a spec key — the object contract's
`FieldSchema` refuses it BY NAME, so a producer that authored it produced a
document the publish door rejects — and it is retired here under ADR-0049
enforce-or-remove (maintainer ruling A on objectui#6153, 2026-09-02;
objectui#7357). `dependsOn`, declared on `BaseFieldMetadata` since objectui#6153,
is now the only spelling, and it is the one every reader widget already used.

What changed, concretely:

- `@object-ui/types` — `BaseFieldMetadata.depends_on?: string[]` is gone. Every
  field-metadata face that inherited it (`LookupFieldMetadata`,
  `SelectFieldMetadata`, …) loses it too. An annotated metadata literal carrying
  `depends_on` is now an excess-property error, which is the intended signal.
- `@object-ui/fields` — `LookupField` read
  `cascadeMeta?.depends_on ?? cascadeMeta?.dependsOn`; it now reads `dependsOn`
  only. This is the behaviour half: hosts that hand the widget an UNTYPED bag
  (`as any`, a JSON metadata document off the wire) were unaffected by the type
  removal alone and are affected by this. The option widgets (`SelectField`,
  `MultiSelectField`, `RadioField`, `CheckboxesField`) never had a snake arm, so
  nothing changes for them.
- `@object-ui/app-shell` — `paramToField()` emitted `depends_on` onto the field
  bag it hands the action-param dialog's widgets. It now emits `dependsOn`. This
  was the one in-repo framework producer of the retired spelling, and the emit
  has to move with the reader: a lookup param declaring the cascade key renders a
  gated picker there, and without this half that gate would have silently
  disappeared, leaving an unfiltered picker. (Precisely, and no larger: that
  dialog supplies dependent values only to the option widgets, so the lookup's
  gate in it never lifts on its own — a pre-existing limitation this change
  neither introduces nor fixes. What moved is a permanent gate, not a working
  cascade.)
- `@object-ui/plugin-grid` — the relational-metadata ledger drops its
  `depends_on` row, because the reader it recorded no longer exists.
- `@object-ui/components` — comment only, no behaviour.

⚠️ Hand-written objectui host applications outside this repository cannot be
measured from here. If yours authors `depends_on` on field metadata, rename it to
`dependsOn`; the shapes are identical (`['country']`, or
`[{ field: 'account', param: 'account_id' }]`).

Unrelated and untouched: `AdvancedValidationRule.depends_on` (cross-field
validation dependencies, a different concept), the object-schema documents the
metadata designer and `resolveActionParams` read (their snake legs read STORED
pre-strict documents — objectui#7642's census verdict), and plugin-gantt's
`dependenciesField: 'depends_on'`, which names a record data field, not this key.
