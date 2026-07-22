---
"@object-ui/components": patch
---

fix(data-table): keep the right-pinned action column HEADER sticky on horizontal scroll (objectui#2784)

The row-actions column is pinned to the right edge by injecting `sticky right-0`
into the column's `className`, which reaches both the body cells and the header
cell. Body cells stayed pinned, but the header cell unconditionally appended a
`relative` position utility (it anchors the column-resize handle) — and since
`cn` is `tailwind-merge`, the later `relative` won over the injected `sticky`.
So the "操作" title scrolled away while its body cells stayed frozen.

The header now detects a right-pinned column (its `className` carries
`sticky` + `right-0`), skips `relative` for it (a sticky cell is already its own
positioning context, so the `absolute` resize handle still anchors correctly),
and re-asserts `sticky right-0 z-20` after `col.className` so tailwind-merge
keeps the pin and it stacks above the body's pinned cells (z-10). Left-frozen
columns, the resize handle, and non-pinned columns are unaffected.
