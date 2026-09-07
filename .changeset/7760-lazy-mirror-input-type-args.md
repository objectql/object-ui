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
their own `z.lazy`. zod 4 defaults such a schema's INPUT parameter to `unknown`, so
the published static input face of every slot spelled through one of them read
`unknown` — wider than every declaration by definition, and silent about what the
mirror accepts. Each now carries its own declaration in both positions
(`z.ZodType<SchemaNode, SchemaNode>` and so on).

**Nothing about validation moved.** The `z.lazy` bodies are untouched, so every
document that parsed before parses now and every document that failed still fails.
`@objectstack/spec` is untouched. The TypeScript declarations (`SchemaNode`,
`AppMenuItem`, `TreeNode`, `NavLink`, `NavigationMenuItem`, `MenuItem`, crud's
`ActionSchema`) are untouched.

**What consumers see.** `z.input` / `z.infer` of any mirror reaching one of these
slots — `body`, `children`, `content`, `items`, `trigger`, and the rest of the
schema-node family — now resolves to the node union instead of `unknown`. That is
strictly more information, but it is a NARROWING of a published type: code that
assigned an arbitrary value into such a slot and relied on `unknown` accepting it
will now be type-checked. Every package in this workspace was rebuilt and
type-checked against the change with no site needing a repair.

**Three mirrors deliberately keep the annotation.** `NavigationItemSchema` and
`FilterBuilderConditionSchema` (`zod/app`, `zod/complex`) accept more than their
declaration states — `id` optional against a required one, `is_null` / `is_not_null`
against `FilterBuilderOperator` — so filling the argument is that comparison and
`tsc` refuses it; `FilterGroupSchema` follows transitively through its `conditions`
arm. Those three are recorded on the card, with the exact refusal, and stay in the
excluded region the parity ledger bounds at runtime.
