---
'@object-ui/core': minor
---

`ComponentRendererProps` is now declared once and re-exported, instead of
hand-declared a second time in `@object-ui/core` (objectui#4594).

`@object-ui/core`'s `ComponentRendererProps` (`src/types/index.ts`) was a
non-generic interface typing `schema` as `SchemaNode`, while
`@object-ui/types`' declaration of the same name is generic —
`ComponentRendererProps< TSchema extends BaseSchema = BaseSchema >` with
`schema: TSchema`. Same name, both exported from their package entry, from two
packages the same consumers import together: which declaration a call site got
depended on which package it reached for, and the two disagree about whether a
primitive node is admissible. Core's is now a re-export of types', which is the
disposition objectui#4580 ruled for `SchemaNode` two lines above it in the same
file, and objectui#4972 for `ComponentInput` — *a structural copy would
reproduce the defect the moment either side moved*.

**Published-surface effect, and the reason it is not neutral.** Resolved
through the TypeScript checker from `core/dist/index.d.ts` over a clean rebuild
of both legs, `ComponentRendererProps` as reached through `@object-ui/core`
moves from non-generic with
`schema: BaseSchema | string | number | boolean | null | undefined` to
`ComponentRendererProps<TSchema>` with `schema: TSchema`, defaulting to
`BaseSchema`. `schema` therefore **narrows** back to the object form — core's
copy had silently widened when objectui#4608 made core's `SchemaNode` a
re-export of types' union — and the type gains a parameter. **Nothing imported
it**, on either side, re-verified repo-wide on the merged ref, so no call site
can observe either move; the narrowing is recorded here because it is a change
to a published type, not because a consumer is affected.

A compile-time pin now holds the reconciliation from
`@object-ui/react` — the only position that resolves both packages through
`node_modules` — alongside the existing `SchemaNode` one. It is a test-only
addition and emits nothing, so `@object-ui/react` takes no bump of its own.
