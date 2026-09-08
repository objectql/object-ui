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

**3. ⚠️ KNOWN GAP, declared rather than papered over: a bundled consumer that never reads
`AnyComponentSchema` can tree-shake the redirect away.** This package declares
`"sideEffects": false` and the arm is filled by a statement in the `./zod` barrel's body, so a
bundler that honours the flag and sees no reference to `AnyComponentSchema` may drop the fill —
and then every child slot validates with the PRE-redirect arm, with no error and no warning.
Who is exposed, stated plainly: an external consumer whose bundler honours `sideEffects: false`
and never reads `AnyComponentSchema` keeps `main`'s accept set for NESTED nodes. Root-level
enforcement is unchanged by the gap, and every consumer whose import graph reads the union —
the `./zod` barrel under Node or vitest, `@object-ui/cli`'s `check` / `validate` (they call
`safeValidateSchema`, which references the union), any bundle that imports `AnyComponentSchema`
— gets the new set at every depth.

Measured on the published `dist/zod` face of this head (Vite 8.2.1 lib build, `es`,
esbuild-minified, `zod` 4.4.3 and `@objectstack/spec` external, so the figures are this
package's own bytes; nested off-spec node = `{ type: 'icon', icon: 'check', size: 'huge' }`
inside `card.body[]`, parsed through `CardSchema`):

| entry | nested off-spec node | bundle (raw / gzip) | fill in output |
| --- | --- | --: | --- |
| barrel, `CardSchema` and `AnyComponentSchema` imported | REFUSED | 750,542 / 206,815 B | present |
| barrel, `CardSchema` only | **ACCEPTED (inert)** | 212,567 / 61,025 B | absent |
| deep-link entry at `layout.zod.js` | **ACCEPTED (inert)** | 212,563 / 61,030 B | absent |

⛔ It is NOT closed here, and the reason is measured rather than argued. The route that closes
it by binding the union inside `SchemaNodeSchema`'s `z.lazy` getter was implemented and pushed,
and CI refused it: `Build Docs` failed with `ReferenceError: Cannot access 'BaseSchema' before
initialization` out of `packages/types/dist/zod/app.zod.js`, because that import makes
`base.zod.ts` depend on the barrel and a bundler is free to evaluate the resulting cycle
category-module-first. Reproduced locally in one line — importing `dist/zod/app.zod.js` throws
with the binding in place and loads clean without it. The other three candidates were measured
too: a narrowed `sideEffects` array is not a legal declaration for this package (one gate
requires every entry form to be named, another refuses a named entry with no load-time effect,
and this package's entry forms are pure), a bare top-level call is dropped by the same flag,
and dropping the flag costs 16,078 gzipped bytes on the console `framework` chunk and moves a
workspace census a guard pins.

⇒ **The card that closes this gap is objectui#8598**: build the `./zod` subpath as ONE bundled
module, so a consumer bundler has no internal graph to link past and every entry — one schema,
the barrel, or a deep link — gets the same accept set. Until it lands, a consumer that bundles
`@object-ui/types/zod` should keep `AnyComponentSchema` in its import graph, which is enough to
make the redirect apply.
