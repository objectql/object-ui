---
"@object-ui/components": patch
---

`page:card` publishes `children` instead of the retired `body`, and `page:section` / `page:footer` / `page:sidebar` publish the `children` slot they render

`inputs` is the published authoring surface, not documentation: the Studio block
designer builds its panel from it, `sdui-parser`'s `gen-manifest.ts` serializes
it into `sdui.manifest.json` and `sdui-intrinsics.d.ts`, and the JSX-page
compiler builds its prop whitelist from it. Two of the `page:*` containers had
drifted from the contract in opposite directions.

`page:card` published `{ name: 'body', type: 'slot' }`. `@objectstack/spec`
retired `PageCardProps.body` in objectstack#5775 (PR objectstack#6281, merged
2026-08-07, ADR-0087 D2) and declared `children` in its place — one composition
slot with one spelling, the same one `grid`, `flex`, `page:section` and
`page:tabs` items already use. The designer was teaching a key the contract now
rejects by name.

`page:section`, `page:footer` and `page:sidebar` declared no `inputs` at all, so
the designer could not authorize the child list those three components exist to
render. The same upstream PR replaced their `EmptyProps` declaration with the
shared `PageContainerProps`, whose single key is `children`; all three now
publish that one slot from one shared literal, mirroring the spec's own single
definition.

Rendering is unchanged in both directions. `PageCardRenderer` still READS `body`
first (`schema?.body ?? schema?.children`) and the three thin containers still
read `schema?.children || schema?.body`, so documents stored under the old
contract keep rendering until the ADR-0087 D2 conversion rewrites the key at
load time — a back-compat read is not a second authorable spelling, the same
split the `page-header-subtitle-alias` sequencing established. No validation
verdict moves either: `children` is already in `sdui-parser`'s `BASE_PROPS` (so
it was never an `unknown-prop`), `isContainer: true` was already set on all
four, and `codegen.ts` filters `slot` inputs out of the generated `.d.ts` where
`SduiBaseProps.children` types it.

What changes for an author is the designer surface: `body` is no longer offered
on `page:card`, `children` is, and the three thin containers gained an
authorable content slot.
