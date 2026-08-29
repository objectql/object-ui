---
'@object-ui/core': minor
'@object-ui/react': minor
'@object-ui/components': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-charts': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-form': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-timeline': patch
---

The spec's `dataSource` element binding is now DECLARED by the blocks that read
it, so the html tier stops reporting the one working saved-view spelling as
`unknown-prop` (objectui#6678).

`PageComponentSchema.dataSource` — `{ object, view, filter, sort, limit }` — is
the one spelling that resolves a saved view for an object-bound block. It works,
and it drew the identical `unknown-prop` warning as the two spellings that do
nothing (`viewName`, `view`), because `validateTree` looks a prop up in the
block's declared `inputs` and no registration declared this key. On the tier
built to accept AI-authored pages, where the diagnostic IS the contract, the
only signal pointed away from the key that works.

Adopting the maintainer ruling of 2026-08-29 — option B **in the injection
form**:

- `ELEMENT_DATA_SOURCE_INPUT` is the single declaration, in `@object-ui/core`
  beside the binding's own semantics; `Registry.register` emits it for any
  registration whose renderer passed through the new `elementDataSourceBlock()`
  seam, exported from `@object-ui/react` next to `ElementDataSourceGate`. One
  mechanism, one copy — not a hand-kept declaration per block, which is the
  shape that drifts and that a new block forgets.
- Seventeen renderers, in thirteen files across twelve packages, reach the seam
  and now publish the key to the save gate, the parser whitelist, the generated
  JSX authoring types and the block list. The card named nine blocks; the tree
  also has `plugin-grid`, `plugin-timeline`, two further `plugin-form` blocks and
  `element:record_picker` — nothing was hand-listed, so the mechanism covered
  them. `element:record_picker` consumes the gate's HOOK and status panels rather
  than the wrapper tag (its object lives under `properties`), and was found by a
  render probe rather than by reading sources.
- `dataSource` on a block that does NOT read it (`flex`, `card`) still reports
  `unknown-prop`. Adding the key to `sdui-parser`'s `BASE_PROPS` was refused for
  exactly this reason — that set mirrors `BaseSchema`, and silencing the key
  everywhere would make the diagnostic lie in the other direction.
- New `check:element-data-source-declaration` fails any source that consumes the
  gate without reaching the seam, so a block added tomorrow cannot forget.

Behaviour of the binding itself is unchanged — this is a declaration, not a
resolution change. The saved view still resolves its columns, and an
unresolvable `view` still fails loudly rather than widening to the object's full
scope.

The spec/registry parity gates (repo-wide and the `record:related_list` per-block
pin) now derive their accepted set from the WHOLE node contract rather than from
`ComponentPropsMap[type]` alone. `PageComponentSchema` accepts and keeps
`dataSource` on a page-component node — it is a node-level key, a sibling of
`type` and `className`, not a per-block prop — so the gates' previous complaint
was measurably wrong. Derived from the spec, not exempted, and both still
discriminate against an invented key.
