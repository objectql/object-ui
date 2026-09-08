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


## Four more public-surface facts this ships

**1. `DashboardWidgetSchema.component` narrows.** That legacy `{ id, component, layout }`
envelope names `BaseSchema` explicitly instead of following the redirect, so the widget
slot keeps admitting `metric-card`, objectui's closed widget-slot extension. One measured
delta and only one: a PRIMITIVE in that slot (`component: 'text'`) was accepted through
`SchemaNodeSchema` and is refused now. No corpus document, fixture or pin writes one.

**2. `SchemaNodeSchema` moves from `TDZ_BOUND` to `MEMOISED`.** Its `z.lazy` getter now
returns the one live union rather than building one per call, so `getter() === getter()`
and `.unwrap() === .unwrap()` are TRUE for this export where they were FALSE. The
supported handle is unchanged and is still the exported wrapper; the other seven mirrors
in that ledger are untouched.

**3. ⚠️ One WIDENING, in the same stroke: `chatbot` nodes with a record `body`.**
`ChatbotSchema.body` mirrors the chat API's body params as
`z.record(z.string(), z.unknown())`, which is WIDER than `BaseSchemaCore.body`. Judging a
child by its own schema therefore admits, at every child slot, a document that the base
arm refused. Measured, corpus-valid chatbot seed plus `body: { model, temperature }`:
accepted at the root before and after; inside `card.body[]` and `div.children[]` REFUSED
before, ACCEPTED now. It is the only wider redeclaration among 109 base-key
redeclarations across the union's arms, and no corpus document writes one — which is why
the 45 to 54 headline does not show it. Declared here rather than eliminated, by ruling:
narrowing a published `chatbot` mirror is its own contract decision, and it is filed as
objectui#8572.

**⚠️ 4. Caveat for BUNDLED consumers — this redirect can be tree-shaken away, and it is not
fixed here.** The arm is filled by this package's `./zod` barrel, and the package declares
`"sideEffects": false`, so a bundler is entitled to drop that fill when a consumer imports one
schema by name without also importing `AnyComponentSchema`. When it does, every child slot
validates with the PRE-redirect arm — no error, no warning, the old accept set, and the fill's
own assertion dropped with it so nothing can announce the failure. Measured on this repo's own
Vite/rollup lib build: an entry importing only `CardSchema` ACCEPTS a nested off-spec node
(370,652 bytes, no fill in the output); the same entry with `AnyComponentSchema` also imported
REFUSES it (1,149,749 bytes, fill present).

Three fixes were measured and none of them is a manifest edit this change may make on its own:
narrowing `sideEffects` to an array is not a legal declaration for this package (one gate
requires an array to name every entry form, another refuses a named entry that has no load-time
effect, and this package's entry forms are pure); a bare top-level call in the barrel is dropped
too, because `"sideEffects": false` is a package-level promise no in-module spelling can
override; and removing the field closes it at a measured cost of 16,078 more gzipped bytes in
this repo's console `framework` chunk, which now FITS its ceiling but moves a workspace census
a guard pins. ⇒ until that is ruled, a consumer that bundles `@object-ui/types/zod` should keep
`AnyComponentSchema` in its import graph, which is enough to make the redirect apply.
