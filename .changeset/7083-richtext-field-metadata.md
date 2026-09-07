---
'@object-ui/types': minor
---

`RichtextFieldMetadata` — the third registry key of `RichTextField` becomes declarable
(objectui#7083, maintainer ruling 2026-09-07, director decision batch #71).

`markdown`, `html` and `richtext` are one widget (objectui#5498). Two of the three
already had an exported metadata type; `richtext` had none, so the runtime served it by
structure while an author could not write its metadata under an annotation at all. The
only way to write one was `as unknown as MarkdownFieldMetadata`, and that deliberate
cast — in this repo's own pin test — was the gap's sole evidence. The state was neither
a union member nor a recorded alias, which is why it had to be rediscovered to be seen.

**New.** `RichtextFieldMetadata` is exported from `@object-ui/types` and joins the
`FieldMetadata` union, so a richtext field's metadata can be written as a typed literal
and narrowed out of the union on `type`:

```ts
import type { RichtextFieldMetadata } from '@object-ui/types';

const doc: RichtextFieldMetadata = {
  type: 'richtext',
  name: 'doc',
  label: 'Release notes',
  rows: 10,
  placeholder: 'Write the release notes…',
};
```

**Additive only.** Nothing is removed or narrowed: `richtext` field metadata that was
previously written through a cast keeps compiling, and every other member of the union
is untouched. The one behavioural surface — `RichTextField` — is unchanged; it already
served all three keys and this release only gives the third one a face.

**The member's shape was derived, not copied from its two siblings.** `type`, `rows`,
`placeholder`, `mobile_fullscreen` and `label` are the keys `RichTextField` actually
reads on the `richtext` path (the last three already sit on `BaseFieldMetadata`, so the
member declares `type` and `rows`); the readonly branch hands the metadata to a cell
renderer that reads `value` only and contributes no key. `max_length` is the one
declared key the widget does not read, and it is there because the cross-check measured
`richtext` symmetric with `markdown` and `html` on every available axis — one widget and
one code path, plus `@objectstack/spec` 17.3.0 `FieldSchema` answering identically for
all three (`rows` admitted, the spec's own `maxLength` admitted, the legacy snake_case
`max_length` refused by name alike). Omitting it would have left `richtext` the one key
of the three whose ceiling cannot be authored — a fresh instance of the asymmetry this
member exists to end.
