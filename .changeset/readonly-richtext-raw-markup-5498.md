---
'@object-ui/fields': patch
---

A readonly `markdown` / `html` / `richtext` form field now renders its content
FORMATTED instead of showing the user its markup source (objectui#5498).

`RichTextField`'s readonly early return rendered `{value}` as a React text child,
so a readonly field of any of those three types displayed the stored markup as
literal characters — a markdown field's asterisks and hashes, a richtext field's
tags. The `prose` classes on that wrapper were the tell: they style rendered rich
content, and there was none to style. Every other read surface — grid, kanban
card, gallery, related list, dashboard record panel and the record detail page's
read mode — dispatches through `getCellRenderer` and rendered the same stored
bytes formatted, so one field disagreed with itself depending on which surface it
was read on.

The readonly branch now renders through the same components `getCellRenderer`
resolves: `markdown` through the GFM renderer, `html` and `richtext` through the
sanitizing HTML renderer. The two renderers moved out of the package barrel into
`widgets/richTextDisplay.tsx` so the widget can reach them without importing the
barrel back, and both sides now read one shared type-to-renderer table rather
than two that can drift apart.

The editor header's format label is fixed with it: it was computed as
`field.format || 'markdown'`, and `format` is declared on `date` / `datetime` /
`time` / `phone` / `auto_number` and on no rich-content type — so it read
`undefined` for every real field and labelled an `html` field "Format: markdown".
The label is now derived from the field type's display pipeline, so it names the
syntax the value is actually stored in.
