---
'@object-ui/types': minor
---

Export `BreadcrumbSchema` and `ObjectTreeSchema` from `@object-ui/types/zod`

`AnyComponentSchema` declares 107 node component types. 105 of them could be
named on the `./zod` barrel — `ButtonSchema.safeParse(node)`, which is what a
designer, a form builder or a targeted test needs. The arms declaring
`type: 'breadcrumb'` (`navigation.zod.ts`) and `type: 'object-tree'`
(`objectql.zod.ts`) could not: both were already `export const` in their own
module, but `index.zod.ts` — the package's only zod entry point — did not
re-export them, so the schemas existed, were maintained, and were applied by the
union while no consumer could name them.

The only route left was `AnyComponentSchema.safeParse(...)`, which answers "is
this SOME valid node" and never "is this a valid breadcrumb" — a `button`
document passes it. Both names now resolve off the barrel, and
`packages/types/src/__tests__/breadcrumb-object-tree-nameable-7917.test.ts` pins
that each one accepts its own document, refuses a wrong-typed declared key by
that key's name, and refuses a document of another node type.

No accept set changes: the two schemas are the same objects the union already
held, and nothing about what `AnyComponentSchema` accepts or refuses moves.
