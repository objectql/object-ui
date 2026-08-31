---
'@object-ui/types': minor
'@object-ui/fields': patch
---

Declare the two consumed-but-undeclared field-metadata keys ruled on
objectui#6140 / objectui#6153 (maintainer 2026-08-25, Option A), and de-cast
the widget reads they legalize:

- `MarkdownFieldMetadata.rows` and `HtmlFieldMetadata.rows` (`@object-ui/types`)
  — the inline-editor height `RichTextField` has always read through an
  `as any` (default 8), aligned with the `TextareaFieldMetadata` precedent and
  `@objectstack/spec` `FieldSchema.rows` (positive integer, multiline editor
  types). The four inert editor keys (`toolbar`/`preview`/`minHeight`/
  `maxHeight`) stay deliberately undeclared and are pinned so.
- `SelectOptionMetadata.description` — secondary option text `LookupField`
  searches on authored static options and emits from `recordToOption`,
  aligned with `@objectstack/spec` `SelectOptionSchema.description`.
- `RichTextField` and `TextAreaField` (`@object-ui/fields`) now read their
  metadata through the declared types instead of `field as any` (the spec-face
  `maxLength` dual-read in `TextAreaField` stays as a documented structural
  read). Behaviour unchanged; `rows` and option `description` are now legal to
  author with an annotated literal.
