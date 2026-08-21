---
'@object-ui/app-shell': patch
---

Studio's form designer canvas now emits the namespaced `FormField.type` spelling
instead of passing `objectDef.fields[x].type` through raw (objectui#4838).

Per the maintainer ruling on that card, a bare spec-type name (`markdown`,
`html`, `richtext`, …) is **not** a legal `FormField.type` — one widget, one
legal spelling, the namespaced widget id. `ObjectFormDesigner` was the measured
producer of the bare spelling: it handed a raw object-metadata type straight to
`isWideFieldType`, a helper whose vocabulary is `FormField.type`. It now
normalizes through `mapFieldTypeToFormType`, the one place that widget decision
is made.

User-visible effect: a `repeater` field is finally laid out full-row on the
canvas, matching the runtime form. `repeater` is a spec `FieldType` that
resolves to the wide `field:grid` widget, but bare `repeater` is not one of
`WIDE_FIELD_TYPES`' bare members, so the raw pass matched nothing — the canvas
showed it at normal width while the real form spanned it. Fields whose spec name
doubles as a widget id (`textarea`, `markdown`, `html`, `richtext`, `grid`) are
unaffected; they matched under both spellings.

The two tolerant consumers this makes look redundant are deliberately left
alone, each scheduled under its own follow-up with deprecation care: the
`field:`-prefix fallback in `renderFieldComponent`, and `WIDE_FIELD_TYPES`' dual
spellings. Removing a tolerance is the consumer-tightening half, and other
producers have not been normalized yet.
