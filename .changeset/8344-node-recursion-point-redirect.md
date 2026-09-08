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
`content/docs`, 554 node documents): **45 refused before, 54 after** — re-derived
unchanged after merging `main` `3f775eeb8`, same pair, same instrument — nine documents,
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


## Three more public-surface facts this ships

**1. `DashboardWidgetSchema.component` narrows.** That legacy `{ id, component, layout }`
envelope names `BaseSchema` explicitly instead of following the redirect, so the widget
slot keeps admitting `metric-card`, objectui's closed widget-slot extension. One measured
delta on that slot and only one: a PRIMITIVE in it (`component: 'text'`) was accepted
through `SchemaNodeSchema` and is refused now. No corpus document, fixture or pin writes
one.

**2. The `chatbot` record `body` is refused NESTED, and still accepted at the ROOT.**
`ChatbotSchema.body` mirrors the chat API's body params as
`z.record(z.string(), z.unknown())`, which is WIDER than `BaseSchemaCore.body` — the only
wider redeclaration among the 109 base-key redeclarations across the union's arms. Judging
a child by its own schema would therefore have ADMITTED, at every child slot, a document
the base arm refused. ⛔ That widening is eliminated rather than declared: the arm the
recursion point installs carries a check that a nested `chatbot` node's `body` still fits
the node slot. Measured, corpus-valid chatbot seed plus `body: { model, temperature }`:
accepted at the root before and after; inside `card.body[]` and `div.children[]` refused
before and refused now. ⇒ the redirect narrows at all 109 redeclarations and widens at
none. The published `ChatbotSchema` is untouched — whether its own `body` should carry the
chat API's params is a separate question, recorded on objectui#8572 and deliberately not
decided here.

**3. The redirect survives BUNDLING, and that is a property of how it is wired.** The arm
is an import binding read inside `SchemaNodeSchema`'s `z.lazy` getter, ⛔ not a write into
a live option array from the barrel's body. The difference is measurable, on this repo's
own Vite/rollup lib build, with an entry that imports only `CardSchema` from
`@object-ui/types/zod`: with the write, the bundler dropped it and a nested off-spec node
was ACCEPTED — the pre-redirect accept set, with no error and no warning; with the
binding, the same entry REFUSES it, because whatever retains `SchemaNodeSchema` retains
the union it names. ⚠️ The cost is real and is stated rather than hidden: that entry grows
from 113,887 to 342,193 bytes gzipped, and this repo's own console `framework` chunk from
72,248 to 90,969 (its ceiling is 100,000). That is the price of the redirect being real
for bundled consumers rather than a promise that depends on a bundler flag.

⚠️ `"sideEffects": false` is unchanged and stays true: with the write gone, this package
performs no load-time side effect at all. ⚠️ One cost is paid inside this repo: a test
that entered the zod graph at a category module rather than at the `./zod` barrel now
throws `ReferenceError` at import instead of silently validating against the old arm, and
102 `packages/types` test files took a one-line barrel-first import because of it.
Consumers cannot hit that: `./zod` is the package's only zod subpath.
