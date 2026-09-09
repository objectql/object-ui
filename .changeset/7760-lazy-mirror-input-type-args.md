---
'@object-ui/types': minor
---

Give seven of the ten recursion-breaking zod mirrors their existing TypeScript
declaration as both type arguments (objectui#7760, maintainer ruling 2026-09-07,
director decision batch #69, reply verbatim 「同意」).

**What changed.** `SchemaNodeSchema` (`zod/base`), `MenuItemSchema` (`zod/app`),
`ActionSchema` (`zod/crud`), `TreeNodeSchema` (`zod/data-display`), `NavLinkSchema`
and `NavigationMenuItemSchema` (`zod/navigation`) and `MenuItemSchema`
(`zod/overlay`) were each annotated `z.ZodType<any>` to break the inference cycle in
their own `z.lazy`. That annotation fills only the first of zod 4's two type
parameters — `z.ZodType<any>` resolves to `ZodType<any, unknown>` — so a slot spelled
through one of these mirrors published two different faces, each wrong in its own
way: `unknown` on the input side (`z.input`), wider than every declaration by
definition and silent about what the mirror accepts; and `any` on the output side
(`z.infer` / `z.output`), which opts the slot out of type checking altogether. Each
mirror now carries its own declaration in both positions
(`z.ZodType<SchemaNode, SchemaNode>` and so on).

**Nothing about validation moved.** The `z.lazy` bodies are untouched, so every
document that parsed before parses now and every document that failed still fails.
`@objectstack/spec` is untouched. The TypeScript declarations (`SchemaNode`,
`AppMenuItem`, `TreeNode`, `NavLink`, `NavigationMenuItem`, `MenuItem`, crud's
`ActionSchema`) are untouched.

**What consumers see.** `z.input` and `z.infer` of any mirror reaching one of these
slots — `body`, `children`, `content`, `items`, `trigger`, and the rest of the
schema-node family — now resolve to the node union. That is strictly more
information, but it is a NARROWING of a published type, and because the two type
parameters started from different places, the break arrives along two vectors:

- **Writes** — input face `unknown` becomes the node union. Code that assigned an
  arbitrary value into such a slot and relied on `unknown` accepting it is now
  type-checked.
- **Reads and casts of parsed output** — output face `any` becomes the node union.
  This is the larger of the two. `any` silenced every member access, every read and
  every type assertion on a parsed value; all of them are checked now, and a direct
  `as` to an unrelated shape becomes a `TS2352` "neither type sufficiently overlaps
  the other" error instead of a silent pass.

This PR hit the second vector inside the repo. `AppActionSchema.items` is
`z.array(MenuItemSchema)`, so its element type went from `any` to `AppMenuItem`, and
`packages/types/src/__tests__/app-action-onclick-refusal-6854.test.ts` — which
asserted `result.data as { items: Record<string, unknown>[] }` on a parse result —
stopped compiling with exactly that `TS2352`, and was repaired to route the assertion
through `unknown`. That is the one site in this workspace that needed a repair; every
other package was rebuilt and type-checked against the change with nothing further to
fix. Consumers of `@object-ui/types/zod` outside this repo should expect repairs of
both shapes, not only the assignment one.

**Three mirrors deliberately keep the annotation.** `NavigationItemSchema` and
`FilterBuilderConditionSchema` (`zod/app`, `zod/complex`) accept more than their
declaration states — `id` optional against a required one, `is_null` / `is_not_null`
against `FilterBuilderOperator` — so filling the argument is that comparison and
`tsc` refuses it; `FilterGroupSchema` follows transitively through its `conditions`
arm. Those three are recorded on the card, with the exact refusal, and stay in the
excluded region the parity ledger bounds at runtime.
