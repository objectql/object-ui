---
---

Comment- and docs-only: `ObjectGridSchema.onNavigate` is now stated as the explicit,
documented exception the maintainer ruled it on 2026-08-19 (objectui#5234, option C).
Nothing is added to or removed from any accept set, and no published behaviour changes.

`@object-ui/plugin-grid`'s `ObjectGrid` reads `schema.onNavigate` at the
`useNavigationOverlay` call, while `GRID_QUERY_INPUTS` does not publish the key — so the
manifest, the designer panel and the generated `sdui-intrinsics.d.ts` deny a key the
renderer honours. That gap is now deliberate and said out loud rather than left to be
re-discovered by the next census:

- An exemption comment at the read site, in the shape objectui#5091 / PR #5241
  established for `columnState`, `hideRowHeightToggle`, `maxInlineRowActions` and
  `rowActionDefs` — with the one difference those four do not share: this key IS
  declared in `@object-ui/types`, so the read is plain rather than a cast.
- A programmatic-only note on the declaration in `@object-ui/types`
  (`ObjectGridSchema.onNavigate`): it is a function value and a schema is a serialisable
  document, so `(recordId, action) => void` cannot survive a metadata round-trip whatever
  declares it, and programmatic callers should prefer `ObjectGridComponentProps` where its
  nine sibling callbacks live.
- `packages/plugin-grid/README.md` carried the un-narrowed universal claim that the grid
  "never reads a callback off the schema", which `onNavigate` falsifies. Narrowed to match
  `content/docs/plugins/plugin-grid.mdx`, which had already been narrowed to "any of these
  nine"; both pages now also name the one callback that is read.
- `gridNonAuthorKeys.test.tsx` extended, not rewritten: the four objectui#5091 keys keep
  every assertion they had, and ten cases are added for this key — the ledger premises
  plus two source-reading cases that pin the exemption prose itself, which is the only
  part of a zero-behaviour-change ruling an ordinary assertion cannot see.

The key is deliberately NOT removed (option A: a breaking public type change plus a
deprecation cycle for zero measured harm) and deliberately NOT added to
`GRID_QUERY_INPUTS` (option B: publishing to the designer a key no author can express).
