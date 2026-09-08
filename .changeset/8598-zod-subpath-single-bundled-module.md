---
'@object-ui/types': minor
---

Ship the `./zod` subpath as ONE bundled module, so the objectui#8344 node
recursion-point fill survives a bundler that honours `"sideEffects": false`
(objectui#8598).

**The defect.** This package declares `"sideEffects": false`, and
`src/zod/index.zod.ts` fills the node recursion point as the initializer of its
`AnyComponentSchema` const. `tsc` emitted that barrel as a module whose only other
content is re-exports — so a bundler resolving
`import { CardSchema } from '@object-ui/types/zod'` followed the re-export to
`dist/zod/layout.zod.js`, needed nothing from the barrel's own body, and the flag
let it drop that body whole. The fill went with it, and every child slot then
validated against the pre-#8344 `BaseSchemaCore` arm — the ~21 base keys and
nothing type-specific — with no error, no warning and no way for the guard inside
the dropped code to notice. objectui#8344 shipped that window DECLARED and pointed
here to close it.

**The change is to the build, not to any schema.** `dist/zod/index.zod.js` is now
a single self-contained module built with Vite in lib mode, overwriting the one
`tsc` output in place. Nothing in `src/` moved: no schema, no accept set at the
source level, and none of `exports`, `files`, `main`, `module`, `types`,
`sideEffects`, `peerDependencies` or `engines`. `zod` and `@objectstack/spec` stay
external, so a consumer keeps one copy of zod and the `instanceof` identities that
come with it.

**What changes for a consumer.** A single-schema or otherwise partial entry into
`@object-ui/types/zod` now gets the same accept set as one that imports the whole
barrel: a nested off-spec node is REFUSED where it was previously ACCEPTED. That is
the objectui#8344 behaviour arriving where it was already meant to be, so metadata
that a full-barrel consumer already validated is unaffected — but metadata that
only ever passed through a tree-shaken entry may now be refused at a child slot,
and refusals there are pre-existing debt this SURFACES rather than creates.

**Cost.** The subpath is now indivisible: a consumer that imports one schema pulls
the whole `./zod` module. Measured with Vite 8.2.1 / rolldown 1.2.3, `zod` and
`@objectstack/spec` external, consumer bundle esbuild-minified: a `CardSchema`-only
entry went from 18,755 B raw / 4,835 B gzipped (fill absent, nested off-spec node
ACCEPTED) to 165,382 B / 37,117 B (fill present, REFUSED). The full-barrel entry is
165,432 B / 37,139 B either way — i.e. a partial entry now costs what the barrel
always cost, which is the whole point: there is no longer a cheaper entry with a
weaker accept set.
