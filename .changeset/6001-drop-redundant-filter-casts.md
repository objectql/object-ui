---
---

Test-only change; nothing published changes. `ValueDataSource.test.ts` drops the ten
`as any` casts on its AST-array `$filter` fixtures
(`packages/core/src/adapters/__tests__/ValueDataSource.test.ts`, objectui#6001).

The casts were written when `QueryParams.$filter` was declared as the MongoDB-style
record alone, so an author writing an ObjectQL AST array had to push the type out of the
way. objectui#3909 / PR objectui#5999 replaced that declaration with the union the data
sources always accepted, and all ten literals — the nine AST shapes plus the degenerate
empty array — now assign bare. No replacement assertion, no widening, no helper, and no
runtime assertion touched: `pnpm --filter @object-ui/core type-check` is green.

One claim on the card did **not** survive measurement, and the correction is worth
keeping. The card justified the deletion partly by predicting that the un-cast fixtures
would become compile-time evidence — that narrowing `$filter` back to the record form
would turn this file red. It does not. Dropping the `| FilterArray` arm locally,
rebuilding `@object-ui/types` so the change reached the `dist/data.d.ts` that
`packages/core/tsconfig.test.json` actually resolves, and re-running the type-check
leaves the file green with zero errors — exactly as PR objectui#5999's own doc comment
says it must, since `Record<string, any>` already accepts arrays structurally. A positive
control under the identical mutation (a slot that genuinely excludes arrays) does turn
these ten lines red, so the zero is a measurement rather than a blind apparatus.

The deletion is therefore worth making for the smaller, true reason: `as any` at a site
where the value is already legal is a no-op that reads as a live constraint, and a reader
who trusts it concludes the array form is illegal here.
