---
'@object-ui/plugin-grid': minor
---

Retire four undeclared authored column reads in `ObjectGrid.generateColumns()`
(objectui#6458).

`ListColumnSchema` is a strict object, so an author who wrote `format`,
`options`, `appearance` or `essential` on a list column was **refused at
publish** with `unrecognized_keys` while the grid happily honoured the key at
runtime. That is the `declared != enforced` split AGENTS.md #0.1 exists to
stop, and it was reachable only through `(col as any)`. All four reads are
removed. Each was re-measured on this branch before deletion: **zero authored
occurrences on a column across `examples/` and `apps/`**, per key, with `field`
as the positive control in the same query shape — so no real author's metadata
changes behaviour today.

What each retirement leaves as the only road:

- `format` and `appearance` — the object-field fallback (`objectDefField?.format`
  / `?.appearance`), which is already the road every measured author uses.
- `options` — the object schema's select options. The column-level override was
  exactly the shape that let AI-authored metadata drift from the schema it is
  supposed to obey; one source for options beats two.
- `essential` — mobile visibility stays positional (`colIndex === 0`).

**Retired for want of authors, not forbidden forever.** If a real request for
semantic mobile-column control arrives, the declare route reopens: declare the
key on `@objectstack/spec` and read it without a cast. What stays ruled out is
the third road — a renderer-side tolerance for a key the schema refuses.

`columnReadBoundary-6458.test.ts` moves with the change: its bound on undeclared
cast reads in that branch is now the **empty set**, so a new one goes red on
arrival rather than accreting quietly.
