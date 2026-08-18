---
---

Internal only — no package is released by this change.

`ObjectGrid` reads `columnState`, `hideRowHeightToggle` and `maxInlineRowActions`
through `(schema as any)`, and the maintainer ruling of 2026-08-18 on
objectui#5091 keeps all three OUT of `GRID_QUERY_INPUTS`: they are host/user-state
channels, not authoring surface. What lands here is the record of that decision —
an exemption comment at each read site and
`packages/plugin-grid/src/__tests__/gridNonAuthorKeys.test.tsx`, which pins that
they stay unpublished, that `@objectstack/spec` rejects them by name, that the
parser therefore reports them as unknown props, and that the renderer still reads
every one of them.

No published surface moves: `GRID_QUERY_INPUTS` is byte-for-byte unchanged, the
generated manifest and `sdui-intrinsics.d.ts` are unchanged, and the only edits to
`ObjectGrid.tsx` are comments.
