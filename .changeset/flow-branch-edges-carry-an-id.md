---
"@object-ui/app-shell": minor
---

Flow branch editor: an edge it creates carries an `id` (objectui#3202).

The Branches editor on a Decision node creates an out-edge when a branch names a
Target it has no edge for. That edge shipped with no `id`, while
`FlowEdgeSchema.id` in `@objectstack/spec` is a required `z.string()` — so the
designer drew an edge, its own live draft validation (`clientValidation.ts`,
which parses the draft with `FlowSchema`) immediately flagged
`edges.N.id: Invalid input: expected string, received undefined`, and saving it
was a 422 from the server's parse of the same schema. The author had done
nothing wrong and there is no UI anywhere that can supply a missing edge id.

Created edges now get `uniqueId('edge', …)` — the same minter every other
edge-creating path in this designer already used (`FlowCanvas`'s `addNode`,
`insertOnEdge`, and the ADR-0044 revise loop). Ids are drawn from the ids
already in the flow **plus the ones minted earlier in the same commit**, since
one apply can create several edges at once and must not mint a number twice.

The gate that would have caught it is now in place: every edge produced by
`applyDecisionBranches` / `syncDecisionEdgesByOrder`, across create, update,
retarget, detach and legacy by-order scenarios, must pass
`FlowEdgeSchema.safeParse`. These functions' output is a **committed** state
that goes straight to `onPatch` → draft → save, so "the designer's own output is
spec-legal" is the contract, not a nicety.

**Type change (minor, public):** `FlowDesignerEdge.condition` in
`views/metadata-admin/previews/flow-canvas-layout` is now the spec's
`ExpressionInput` — a bare CEL string, or the ADR-0089 envelope whose `dialect`
discriminant is **required**. It was `string | { source?: string }`, which
described an envelope the server rejects and that nothing in this repo has ever
produced. Code that assigned a `dialect`-less `{ source }` to an edge condition
no longer compiles; such a condition was already refused at save, so this only
moves the failure to where it can be fixed. The type is **imported** from
`@objectstack/spec` rather than restated, so the mirror cannot go stale, and it
is pinned by compile-time assertions in a project CI actually type-checks
(`tsconfig.typetests.json`). The two other places that restated the same
over-wide shape follow: `FlowEdgeInspector` (which only ever commits the
bare-string form) and `FlowPreview`, whose duplicate declaration is deleted in
favour of the canvas's own type.

Why the type is part of a bug fix: that over-wide read type already cost a wrong
defect diagnosis — objectui#3171 was filed against the phantom `{ source }`
envelope and does not reproduce, while the real spec-rejected shape the designer
emits was this missing `id`. A type that cannot describe a shape the spec
rejects cannot send the next reader down that road either.

`uniqueId` also moves from `inspectors/_shared.tsx` to `inspectors/unique-id.ts`
(re-exported from `_shared`, so every existing import is unchanged) so that pure
reconciliation modules can share the one minter without dragging React and the
`@object-ui/components` barrel into their unit tests — measured at 7.4s of
module load versus 63ms.
