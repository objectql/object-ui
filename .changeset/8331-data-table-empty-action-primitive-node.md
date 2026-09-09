---
'@object-ui/components': minor
---

`data-table`'s `emptyAction` now accepts the whole `SchemaNode` union it declares — a
bare string node renders instead of vanishing (objectui#8331).

**Behaviour change on a published surface, deliberately.** `DataTableSchema.emptyAction`
is declared `SchemaNode` on both published faces — `packages/types/src/data-display.ts`
and its Zod twin in `packages/types/src/zod/data-display.zod.ts` — and `SchemaNode` is
`BaseSchema | string | number | boolean | null | undefined`. The empty-state render path
additionally required `typeof … === 'object'`, so an authored
`emptyAction: 'Create the first record'` rendered nothing and reported nothing: declared
wider than enforced, failing in the direction that loses the author's content without a
diagnostic. A node that renders nothing today therefore starts rendering.

The declaration is unchanged. It was the correct side — the object-only test was not
protecting the renderer from anything it cannot handle. What `SchemaRenderer` does with a
primitive has been pinned since objectui#4548: a non-empty string renders as its own
text, and `''` / `0` / `false` render nothing. The guard was discarding input the
declaration promises to accept.

Same defect, same answer, one slot over: objectui#7105 (director seat, decision batch
#69, 2026-09-07) settled the identical shape on `EmptySchema.action` as **relax the
renderer, do not narrow the declaration**, and shipped it through the repo's existing
permanent bridge `toRenderableSchema`. Nothing had to be invented here either.

**A second, smaller behaviour change ships with it, and it is a bug fix.** With
`emptyAction: 0` the old `&&` chain evaluated to the number `0` itself, which React
renders — so a stray `"0"` appeared inside the empty state. That is the numeric-falsy JSX
trap rather than a decision, it was measured rather than assumed, and the ternary that
replaces the chain yields `null` instead.

**What did NOT change.** The slot still mounts through `SchemaRenderer` rather than
resolving the registry itself, so the single central `visibleWhen` gate still applies to
an authored `emptyAction` exactly as before (objectui#5926 gap 1, pinned in
`data-table-empty-action-visible-when.test.tsx`, green on both sides of this change).
`''` / `0` / `false` still render nothing, which is the same answer `SchemaRenderer`
gives them: the truthiness leg is kept precisely so those two never reach the bridge,
whose `String` mapping would otherwise turn them into the text `"0"` and `"false"`.

**Migration.** Nothing has to change. Metadata that already authored an object node in
this slot is unaffected. Metadata that authored a bare string was rendering nothing and
now renders that string — which is what the declaration always promised.
