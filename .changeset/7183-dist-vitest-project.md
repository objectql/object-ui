---
---

Test and CI infrastructure only — nothing this change touches is published, so no package
releases from it.

Adds a fourth vitest project, `dist`, holding built-artifact pins: tests that import their
package's BUILT bundle instead of its `src`. The root config aliases every workspace package
to `src`, which is correct for the ~2000 tests that want fast source feedback and leaves
"does the shipped bundle still do X" structurally unanswerable. Until now such a test could
not be committed at all — turbo's `test` task is `dependsOn: ["^build"]`, the DEPENDENCIES'
builds and not the package's own, so a `dist`-importing test landed in CI with no `dist` to
import. That reads as NOT MEASURED rather than as a red pin, and the usual repair (delete it,
or let it skip when `dist` is missing) leaves a green suite that measures nothing.

The one file the changeset-presence gate flags,
`packages/components/src/__tests__/page-header-action-ids.dist.spec.tsx`, is under `src/` but
ships nowhere: the package publishes `files: ["dist", …]`, and its `tsconfig.json` build
excludes `src/__tests__` outright. The rest of the change is `turbo.json`, `vitest.config.mts`,
the root and `@object-ui/components` `package.json` scripts, and one CI step — no runtime
source, no published contract, no behaviour change for any consumer.
