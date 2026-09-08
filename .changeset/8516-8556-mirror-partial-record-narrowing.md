---
'@object-ui/types': minor
---

**Breaking for authored metadata, at validation time:** two zod mirrors in
`@object-ui/types/zod` now state their own declaration's key vocabulary instead
of `string` (objectui#8516, objectui#8556).

| key | mirror was | mirror is |
| :-- | :--------- | :-------- |
| `GridSchema.columns` (`zod/layout.zod.ts`) | `z.record(z.string(), z.number())` | a PARTIAL record over the six breakpoints |
| `ReportComponentSchema.exportConfigs` (`zod/reports.zod.ts`) | `z.record(z.string(), ReportExportConfigSchema)` | a PARTIAL record over `ReportExportFormat` |

Both declarations already stated the closed set — `columns` since objectui#8505,
`exportConfigs` since objectui#6121 — so each mirror was accepting a spelling its
own published type refuses. This is a pull-back to the declaration, not a new
constraint: `os-ui validate` / `check` in `@object-ui/cli` are the real consumers
of these mirrors, and they were passing documents `tsc` rejects.

**What now fails that used to pass.** A `grid` whose responsive map is keyed
outside `xs` `sm` `md` `lg` `xl` `2xl` — `{ xxl: 6 }` is the one to expect,
because it is the Bootstrap/Ant spelling an author reaches for first — and a
`report` whose `exportConfigs` is keyed outside `pdf` `excel` `csv` `json`
`html`. Both were ALREADY broken at runtime: the grid renderer reads exactly the
six keys and the export engine exactly the five formats, so a document the
mirror used to accept rendered at the default column count, or exported nothing,
with no error and no warning. The narrowing refuses documents that were already
being silently ignored; it refuses nothing that works today.

**Migration:** `xxl` is `2xl`; `XL` and `2XL` are `xl` and `2xl`. The refusal
names the offending key — `Path: columns → xxl`, `Code: invalid_key` — through
`@object-ui/cli`'s union-arm expansion.

**Measured accept set in the corpus, before grading this.** Across every tracked
file in this repository and in the `objectstack` sibling checkout: 33 grid nodes
carry an object-valued `columns`, and every out-of-vocabulary key among them is
a deliberate negative fixture inside objectui#8505's own test file. The authored
corpus — `examples/schema-catalog`, `content/docs`, `skills/objectui`,
`apps/site`, the renderer fixtures — is 28 sites, all six-breakpoint-clean.
`exportConfigs` has zero authored inhabitants in either repository. So this
narrowing refuses **zero** documents that exist today, which is why it is graded
`minor` with the break spelled out rather than escalated.

**The spelling is `z.partialRecord`, and that is load-bearing.** ⛔ Not
`z.record(z.enum([…]), …)`: measured on zod 4.4.3, the plain record over an enum
key REQUIRES every member, so `{ md: 2 }` stops parsing — it would trade this
divergence for its exact opposite, and on `exportConfigs` it would re-impose the
total-`Record` authoring face objectui#6121's maintainer ruling removed. That
measurement is pinned executably in
`__tests__/mirror-partial-record-narrowing-8516.test.ts`, at compile time (the
inferred map is `Partial<Record<…>>`, not `Record<…>`) and at run time (one
accepting row per member), so it cannot rot into folklore.
