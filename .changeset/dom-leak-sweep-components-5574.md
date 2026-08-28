---
---

Tests only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. The one file changed is
`packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx`, which
`packages/app-shell/tsconfig.json` excludes from the build program
(`"exclude": [… "**/*.test.tsx"]`).

Measured rather than asserted, because emitted-output behaviour varies per package:
`packages/app-shell/dist` was built twice from a cleared `dist/` **and** a cleared
`tsconfig.tsbuildinfo` — once at the `origin/main` version of that file, once at this
branch's version — and sha256-compared. 862 emitted files, 431 of them `.d.ts`, every
hash equal. (The first attempt at this measurement read as an empty `dist/`: `tsc` is
`composite`, so with the build info left in place it skipped the emit entirely and
produced no output to compare. Clearing the build info is part of the measurement,
not a detail.)

Widens the objectui#3291 DOM-leak canary sweep to `packages/components/src/renderers/**`.
That family — 158 registry-reachable types across five namespaces — was outside the
gate's discovery entirely, which is why `ui:grid`'s leak had to be found by hand. The
first run records a ledger: 119 of 158 targets leak, in eight measured shapes, every
renderer named. Nothing is skipped or allow-listed; the per-target assertion stays exact
set equality in both directions, so a renderer fix cannot go green until its ledger row
is deleted in the same change.
