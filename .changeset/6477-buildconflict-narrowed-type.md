---
---

Type-only change in `@object-ui/plugin-detail`: `InlineEditSaveBar`'s internal
`buildConflict` callback now takes the type `isConcurrentUpdateError` narrows to,
instead of `any`, and the `as Record<string, unknown> | null` cast that the `any`
made necessary is gone.

Nothing releases. Measured, not assumed: building the package before and after
the change and comparing all 52 emitted `.js` / `.cjs` / `.d.ts` artefacts leaves
51 byte-identical, including `dist/index.js`, `dist/index.umd.cjs` and
`dist/index.d.ts`. The single delta is `dist/InlineEditSaveBar.d.ts`, which gains
the `BuildConflict` type its pin test reads; the package's `exports` map declares
only `"."`, so that file is not resolvable by any consumer, and the published
`dist/index.d.ts` does not mention the name. Published behaviour and published
types are both unchanged.
