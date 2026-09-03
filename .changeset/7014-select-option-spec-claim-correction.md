---
'@object-ui/types': patch
---

Correct three false `@objectstack/spec` alignment claims on field metadata, and pin the
real boundary (objectui#7014).

**No contract change.** No type, schema, export or runtime path moves. What changes is
published JSDoc — the text that reaches your editor tooltips through `.d.ts` — which was
asserting the opposite of what the spec does.

Three doc comments claimed the installed `@objectstack/spec` DECLARES a key that it in
fact **refuses by name**. Measured on `@objectstack/spec@17.2.0`, each paired with a
control that accepts the same payload minus the key:

- `SelectOptionMetadata.description` said it "Aligns `@objectstack/spec`
  `SelectOptionSchema.description`". That schema is `.strict()` over exactly
  `{label, value, color, default, visibleWhen}`; `description` fails with
  `unrecognized_keys`.
- `MarkdownFieldMetadata.rows` and `HtmlFieldMetadata.rows` said `@objectstack/spec`
  `FieldSchema.rows` declares the key "authorable on exactly the multiline editor
  types". `FieldSchema` refuses `rows` by name on all four of
  textarea/markdown/html/richtext.

The keys themselves stay declared and stay consumed — `LookupField` searches an option's
`description` (objectui#6153) and `RichTextField` reads `rows` (objectui#6140). Only the
attribution was wrong, and it mattered in a specific way: `FieldSchema` routes a select
field's `options` through the strict option schema, so authoring `description` on an
option makes `PUT /api/v1/meta/object/:name` fail the **whole field** with a 422
`INVALID_METADATA`. The comments were inviting exactly that write. They now say these are
objectui-side read-model extensions that must never reach authored object metadata.

A new pin (`select-option-spec-extension-7014.test.ts`) asserts the spec's option key set
and each by-name refusal, so if the spec ever adopts one of these names the claim is
re-opened loudly instead of silently becoming true.
