---
"@object-ui/fields": patch
---

A populated `richtext` field no longer renders as a blank cell (objectui#5452).

`richtext` stores HTML — the spec documents the type as "Formatted content with
HTML/WYSIWYG", the showcase seed's own specimen is `<p>Rich <strong>text</strong></p>`,
and this repo's designer bridge already maps `richtext` onto its `html` type. The
display registry nevertheless dispatched it to `MarkdownCellRenderer`, whose
sanitizing GFM pipeline runs react-markdown with no `rehype-raw` and therefore drops
raw HTML. Because a richtext value is *entirely* HTML, everything was dropped and the
cell body came out empty — with no error, no fallback and no console warning, so a
populated field read as an empty field and anyone auditing data through a grid
concluded the records were blank. Measured on the same stored bytes, a neighbouring
`html`-typed column rendered them correctly, which is what ruled out "the value never
arrived".

`richtext` now resolves to `HtmlCellRenderer`, which sanitizes with `sanitizeHtml`
(script/style/iframe/object/embed blocks, inline event handlers and `javascript:`
URLs removed) and keeps everything a rich-text editor legitimately emits — headings,
paragraphs, emphasis, lists, links, quotes. One map entry fixes every read surface at
once: the grid, the kanban card, the gallery, the related list, the dashboard record
panel and the record detail page all resolve their read-mode cells through this same
`getCellRenderer`.

The markdown pipeline is untouched. Passing raw HTML through it would have "fixed"
one type by moving every `markdown` cell's trust boundary, so `markdown` still drops
raw HTML — pinned alongside the fix, on the same bytes `richtext` must now render.
