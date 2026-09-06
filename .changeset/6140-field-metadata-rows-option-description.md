---
'@object-ui/types': minor
'@object-ui/fields': patch
---

Declare the two consumed-but-undeclared field-metadata keys ruled on
objectui#6140 / objectui#6153 (maintainer 2026-08-25, Option A), and de-cast
the widget reads they legalize:

- `MarkdownFieldMetadata.rows` and `HtmlFieldMetadata.rows` (`@object-ui/types`)
  — the inline-editor height `RichTextField` has always read through an
  `as any` (default 8), following the `TextareaFieldMetadata` precedent. NOT a
  spec key: `@objectstack/spec` `FieldSchema` refuses `rows` BY NAME
  (`unrecognized_keys`) on all four of textarea/markdown/html/richtext, so it is
  an objectui render hint that must not be written into authored object
  metadata. The four inert editor keys (`toolbar`/`preview`/`minHeight`/
  `maxHeight`) stay deliberately undeclared and are pinned so.
- `SelectOptionMetadata.description` — secondary option text `LookupField`
  searches on authored static options and emits from `recordToOption`. NOT a
  spec key either: `@objectstack/spec` `SelectOptionSchema` is strict over
  exactly `{label, value, color, default, visibleWhen}` and refuses
  `description` BY NAME, and `FieldSchema` routes `options` through that schema,
  so the key must never reach authored object metadata.
- `RichTextField` and `TextAreaField` (`@object-ui/fields`) now read their
  metadata through the declared types instead of `field as any` (the spec-face
  `maxLength` dual-read in `TextAreaField` stays as a documented structural
  read). Behaviour unchanged; `rows` and option `description` are now legal to
  author in an objectui **annotated literal** — never in an object document sent
  to the platform.

Both spec attributions above were corrected in place before release
(objectui#7537): as first written this changeset claimed each key was "aligned
with" a `@objectstack/spec` schema member that does not exist. Re-measured on
`@objectstack/spec@17.2.0`, each refusal is paired with a control that accepts
the same payload minus the key. Same correction as objectui#7014 / PR #7510 made
to the published JSDoc; the package bumps and the declared behaviour are
unchanged.
