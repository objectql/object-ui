---
---

Tooling + test-only (objectui#4801). No package may name itself in a module specifier inside
its own `src/`, and a new CI gate — `pnpm check:self-import`,
`scripts/check-package-self-import.mjs` — enforces it.

A file inside a package that imports the package's own name resolves, legally, through that
package's `exports` map to `dist/`. What does not exist is an ordering: turbo gives
`type-check` `dependsOn: ["^build"]`, the DEPENDENCIES' builds, never the package's own. So on
a cold CI cache the declarations the specifier points at have not been produced yet and the
file fails with `TS2307`. PR #4789's first CI run was red on exactly one line of that shape in
`packages/fields/src`, and no local workflow can see it: every one of them builds before it
type-checks, so a stale `dist/` makes the tree green on any machine that has ever run a build.

The two remaining sites were converted to relative imports —
`packages/core/src/__benchmarks__/core.bench.ts` and
`packages/components/src/__tests__/snapshot-critical.test.tsx` — and the `paths` entry in
`packages/components/tsconfig.test.json` that existed only to redirect that self-import away
from `dist/` is gone with it. No published behaviour changes: a benchmark file, a snapshot test
and repo tooling, so this declares "no release" rather than a bump.
