---
---

Docs only, publishes nothing: the `Field Schema` block on every
`content/docs/fields` page declared an interface of its own, so
`check-doc-snippet-types` compiled it **vacuously** — a self-declared interface
with no imports type-checks no matter what it says, because nothing in the block
refers to anything the packages export (objectui#6138). The gate reported those
pages green and structurally could not see whether the documented shape matched
the shipped one. This is batch 1 of 2: the shared page plus four converted
pages, proving the mechanism end to end before it is applied to the rest.

Each converted `Field Schema` block is now a literal **annotated** with that
field type's exported `*FieldMetadata`, so the sealed type's excess-property
check judges every documented key. The page becomes structurally incapable of
teaching a key the type does not have.

Measured before converting: all 26 pages diverged from their exported type, and
on 24 of them the divergence was **entirely** `FieldWidgetComponentProps`
members — a real, exported, reader-facing surface filed under a heading that
says "Field Schema". Deleting them would have deleted correct API, so the shapes
are separated instead of one being dropped: a new `content/docs/fields/widget-props.mdx`
documents `FieldWidgetComponentProps` once, with a gate-compiled example and the
type named as the source of truth, and the field pages link to it. That page
carries no hand-maintained key list — the type has 76 members and a prose
restatement of a declared surface is the defect class objectui#6086 is open for.

Three documentation defects the conversion forced out into the open, each a page
teaching something no shipped type declares:

- `date.mdx` documented the range bounds as `min` / `max`; `DateFieldMetadata`
  declares `min_date` / `max_date`, and the sibling `datetime.mdx` already
  documented that spelling. Two adjacent reference pages taught two spellings of
  one concept and one of them did not exist. The docs are corrected; the type is
  not touched.
- `textarea.mdx` named `TextAreaFieldMetadata`; the export is
  `TextareaFieldMetadata` (lowercase `a`). A name that must resolve, so it now
  does.
- `rich-text.mdx` named `RichTextFieldMetadata`, which does not exist at all. The
  page's own block says `type: 'markdown' | 'html'`, so it resolves against the
  existing `MarkdownFieldMetadata` / `HtmlFieldMetadata` pair rather than a
  minted type. It also documented `toolbar`, `preview`, `minHeight` and
  `maxHeight`, which `RichTextField` reads nowhere (`minHeight` / `maxHeight`
  have zero occurrences in `packages/fields/src`), and `rows`, which it does read
  through an `as any` while neither metadata type declares it — filed as
  objectui#6140 with that measurement in it.

The gate's blocks-to-compile count rises from 225 to 227 — the new page's two
blocks, the conversions being one-block-for-one-block — with diagnostics at 0, no
new `FRAGMENT_MARKER` declarations, and the declared-fragment count unmoved at 111.
