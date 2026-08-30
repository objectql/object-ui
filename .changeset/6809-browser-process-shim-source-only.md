---
---

Scope `packages/components`' browser `process` shim to the package SOURCE, so
its own test project keeps node's real `process` global.

`src/global.d.ts` declared `const process: { env: { NODE_ENV: string } }`, and
`tsconfig.test.json` globs `src/**/*.d.ts` in for the ambient declarations its
tests rely on. That project sets `"types": ["node"]`, so `@types/node` is in the
program — but the ambient declaration REPLACES the node global rather than
augmenting it, and because `@types/node` spells its module as `export = process`
it also became what `import process from 'node:process'` resolved to. All three
obvious spellings failed identically with `TS2339: Property 'cwd' does not exist
on type '{ env: { NODE_ENV: string; }; }'`, while `types: ["node"]` sat in the
config, correct. The plain `join(process.cwd(), …)` idiom `packages/i18n`'s
ratchet tests use did not compile one directory over.

Measured before choosing a repair (`tsc --listFiles`, both projects): the source
project contains **zero** `@types/node` files and the test project contains 82,
and removing the declaration turns the SOURCE project red with five
`TS2591: Cannot find name 'process'` across `renderers/basic/div.tsx`,
`renderers/basic/span.tsx` and `renderers/form/form.tsx`. The shim is
load-bearing for the source — so it was narrowed, not deleted:

- the declaration moved to `src/browser-process-shim.d.ts`;
- `tsconfig.test.json` names that one file in `exclude`;
- `src/__tests__/browser-process-shim-scope.test.ts` pins both halves — its own
  compilation is the compile-time pin (a runtime assertion cannot see this
  defect, since all three spellings always worked at runtime).

No release: declaration files and `tsconfig.test.json` are checking-only inputs.
Verified that neither `src/global.d.ts` nor the new shim is emitted — the built
`dist/**/*.d.ts` contains no `process` declaration at all — so the published
surface is unchanged.
