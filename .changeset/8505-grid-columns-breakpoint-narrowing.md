---
'@object-ui/types': minor
---

**Breaking for TypeScript consumers, at compile time only:** `GridSchema.columns`
in `@object-ui/types` is now `number | Partial<Record<BreakpointName, number>>`
instead of `number | Record<string, number>` (objectui#8505). A `grid` node whose
responsive map is keyed by a spelling no renderer reads — `{ xxl: 6 }`,
`{ XL: 5 }`, `{ '2XL': 6 }` — stops compiling, and `tsc` names the member it
meant (`'XL' does not exist in type 'Partial<Record<BreakpointName, number>>'.
Did you mean to write 'xl'?`). Nothing changes at runtime and no emitted byte
moves: the declaration erases.

**What was measured.** `@object-ui/components`' `grid` renderer reads exactly six
keys — `xs` `sm` `md` `lg` `xl` `2xl`, the whole of `BreakpointName` — and
`grid-breakpoint-columns-7097.test.tsx` already pinned that read set exhaustive in
both directions. So the renderer and its pins agreed on six while the type still
said "any string": on this branch's base,
`const node: GridSchema = { type: 'grid', columns: { xxl: 6 } }` compiled, passed
the zod mirror, emitted no class, and rendered the grid at its `xs` count on every
screen with no error and no warning. That is the declared-but-not-read shape
objectui#7097 fixed at the value level, reached through the type surface instead
of the renderer, and this was its last copy.

**No producer was touched, and that is a measurement rather than an absence.**
`turbo run type-check` across the whole repo — 81 tasks, every package's source,
test and example program — is green with the narrowing applied and zero call sites
edited. The structural reason is pinned in the new test: a string index signature
supplies every optional member of the target, so code assigning into `columns`
from a computed `Record<string, number>` still type-checks, and only fresh object
LITERALS meet excess-property checking. The narrowing is therefore a check on the
authoring spelling, which is where the defect was authored.

**The zod mirror WAS deliberately not narrowed here — corrected in #8573.** This
paragraph said `zod/layout.zod.ts` still validates `columns` as
`z.record(z.string(), z.number())`, so the JSON authoring face — `os-ui validate`
/ `check` in `@object-ui/cli`, the real consumer of these mirrors — still admits
`{ xxl: 6 }`. #8573 narrowed that mirror to a partial record over the six
breakpoints (objectui#8516), so the JSON face now refuses `{ xxl: 6 }` exactly as
the declaration above does. Its two supporting statements went with it, and #8573
quotes each in its current state rather than re-arguing it: the byte measurement
that deferred the narrowing — 70,999 gzip bytes against a 71,000 `framework`
ceiling, one byte of headroom — is retired, because PR #8550 landed the
maintainer's raise to `PER_CHUNK_GZIP_CEILINGS.framework` `100_000` against a
`PER_CHUNK_BASELINE.framework` of `72_245`; and the handoff assertion described
here as holding the current reading visible is flipped to a refusal in #8573, so
it no longer asserts acceptance.
