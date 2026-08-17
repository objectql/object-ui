---
'@object-ui/core': patch
'@object-ui/plugin-designer': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-view': patch
---

Four packages stop publishing tooling material in their `dist/`

Each of these packages spelled its build exclusions as `*.test.*`, while this repo's tooling convention is a directory one — `__tests__` / `__mocks__` / `__benchmarks__`, exactly as `TOOLING_FILE` in `scripts/check-phantom-dependencies.mjs` spells it. Any tooling file whose *name* is not `*.test.*` therefore stayed in the emit program and shipped in the tarball. This is the same shape and the same cause as objectui#4006, which fixed `@object-ui/fields` and `@object-ui/plugin-editor` by the filename criterion and so did not reach these four.

Measured by building each package from a cleared `dist/` on both sides of the change. Nine files disappear, none appears, and every surviving file is untouched — the totals move by exactly the count removed:

| package | `dist/` files | removed |
| --- | --- | --- |
| `@object-ui/core` | 176 to 174 | `dist/__benchmarks__/core.bench.js`, `core.bench.d.ts` |
| `@object-ui/plugin-designer` | 70 to 66 | `dist/__tests__/__mocks__/plugin-form.d.ts`, `plugin-grid.d.ts`, and both `.d.ts.map` |
| `@object-ui/plugin-grid` | 62 to 60 | `dist/__tests__/explainDouble.d.ts` and its `.d.ts.map` |
| `@object-ui/plugin-view` | 13 to 12 | `dist/__tests__/explainDouble.d.ts` |

Only `@object-ui/core`'s had runtime weight. The other eight are declarations nothing resolves, but `core.bench.js` is a real emitted module whose first import is `import { bench, describe } from 'vitest'` — a runtime import of a package a consumer never installs, since `vitest` is a devDependency of `@object-ui/core` and devDependencies are not installed transitively. Nothing resolves it today either (it is not in the `exports` map), so no consumer breaks in either direction; this is the tarball shedding files nothing reached.

No type coverage leaves with the emit. The three plugins' helper and mock files are already program inputs of the `tsconfig.test.json` that each package's `type-check` chains, reached through the imports in the suites beside them — `tsc --listFiles` names all four files on both sides of the change. `core.bench.ts` had no such edge, since nothing imports a benchmark, so it is now named explicitly in `packages/core/tsconfig.test.json`. That move was deliberate rather than forced: `scripts/check-type-check-coverage.mjs` enumerates `*.test.ts(x)` only, so a benchmark that no program reads is invisible to it, and dropping the coverage silently would have been the "coverage that was right by accident" objectui#4006 recorded. Verified by appending a provably-false annotation to the benchmark, which turns `tsc -p packages/core/tsconfig.test.json` red at exit 2.
