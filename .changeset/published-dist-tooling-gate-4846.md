---
---

Tooling + CI only (objectui#4846). A published package's build output may no longer carry tooling
material, and a gate now says so: `pnpm check:published-dist`,
`scripts/check-published-dist-tooling.mjs`.

The property had been broken three times and found by a human every time — objectui#4006 measured
73 `*.test.d.ts` files inside the published `dist/` of `@object-ui/fields` and
`@object-ui/plugin-editor`; objectui#4836 measured 9 more across `@object-ui/core`,
`@object-ui/plugin-designer`, `@object-ui/plugin-grid` and `@object-ui/plugin-view`, one of them a
real emitted module whose first statement imports `vitest`. In that defective state every gate in
this repository exited 0.

The criterion is artifact-level, because objectui#4846 measured the cheap static one ("no build
tsconfig program may contain a tooling file") and it reds five packages that emit nothing wrong: a
tooling file in a *checking* program is correct, and only a tooling file in an *emitting* program
is a defect. So the gate builds every published package itself and reads each tarball's file list
from `npm pack --dry-run`. It cannot pass vacuously: a published package that contributes no build
output is a finding rather than a skip, and a failed build is a failure.

Wired where the harm materialises, per the 2026-08-16 ruling on that card — `pnpm
changeset:publish` now runs the gate before `changeset publish`, so a defective tarball stops the
release — plus a nightly `published-dist-gate.yml`. Deliberately **not** a per-PR job: the
criterion needs a full-repo build and this repository has none per pull request.

No published behaviour changes: a gate, its unit tests and the CI/CD page, so this declares "no
release" rather than a bump.
