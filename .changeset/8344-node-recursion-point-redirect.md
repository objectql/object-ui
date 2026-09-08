---
'@object-ui/types': minor
---

Redirect the node recursion point from `BaseSchemaCore` to `AnyComponentSchema`
(objectui#8344) — a nested node is now judged by its OWN component schema.

**Behaviour change, deliberately, at every depth below the root.** Every child slot
(`body`, `children`, and every per-component redeclaration of them) is
`z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])`, and `SchemaNodeSchema`'s
component arm was `BaseSchemaCore` — the ~21 base keys and nothing type-specific. So
per-type enforcement was ROOT-ONLY, for every component type: objectui#7869 measured
an off-spec `size` on a nested `icon` node being ACCEPTED while the same node standing
alone was refused. The arm is now the union of the registered component mirrors, so
the same node gets the same verdict at every depth.

⛔ **Nothing here is `.strict()`.** `BaseSchemaCore` keeps its passthrough, no schema
gained a `catchall`, and no declaration was repaired. Measured over the catalog +
docs corpora on `c90395b2` (431 catalog files + the `json` fences under
`content/docs`, 554 node documents): **45 refused before, 54 after** — nine documents,
each one pre-existing debt this SURFACES rather than creates. Four have a child whose
`type` resolves in no arm; five carry a child already red under its own schema and
shielded until now by the recursion point.

**What an author sees.** A document whose nested node is off-spec — a bad enum value,
a wrong-typed key, a `type` no component mirror declares — is refused now, where it
parsed green before. That is the point of the change, and it is why this ships behind
a contract review rather than as a patch.

**Two mechanical notes for anyone editing the wiring.** `AnyComponentSchema` is built
in `zod/index.zod.ts` from all 13 category modules and 14 modules import
`zod/base.zod.ts`, so the arm cannot be an import — `z.lazy` defers evaluation, not
the module graph. It is a written option slot that `index.zod.ts` fills inside
`AnyComponentSchema`'s own initializer, and it is a `z.union` option rather than a
`z.lazy` holder because `z.lazy` memoises its getter: a holder would let whichever
module graph parsed first decide the accept set for the whole process. Both
constraints are measured, and the reasoning lives on `defineNodeComponentUnion` in
`zod/base.zod.ts`.
