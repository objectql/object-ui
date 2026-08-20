---
---

Internal only — no package is released by this change.

`ObjectGrid` reads `rowActionDefs` through `(schema as any)`, and the maintainer
ruling of 2026-08-19 on objectui#5091 keeps it OUT of `GRID_QUERY_INPUTS`: it is
DERIVED by the host from the object's own actions (`app-shell/src/views/
ObjectView.tsx:1968` filters `objectDef.actions` by `locations: ['list_item']`),
not written by a view author. That ruling knowingly reverses the 2026-08-18 line
which had sent this one key into the manifest as `bulkActionDefs`'s "symmetric
partner" — a premise measurement falsified, since the spec's `strictObject`
rejects `rowActionDefs` by name while accepting `bulkActionDefs`.

What lands here is the record of that decision — an exemption comment at each of
the two read sites and four more assertions in
`packages/plugin-grid/src/__tests__/gridNonAuthorKeys.test.tsx`, which pin that
the key stays unpublished, that `@objectstack/spec` rejects it by name, that the
parser therefore reports it as an unknown prop, and that the renderer STILL
READS it on both of its channels — the row menu and the `$select` projection.

No published surface moves: `GRID_QUERY_INPUTS` is byte-for-byte unchanged, the
generated manifest and `sdui-intrinsics.d.ts` are unchanged, and the only edits
to `ObjectGrid.tsx` are comments.
