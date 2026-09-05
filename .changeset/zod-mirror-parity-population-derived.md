---
---

Test-only change: `packages/types/src/__tests__/zod-mirror-parity.test.ts` now derives its
pair-population figure and both of the differences its header quotes, instead of restating
them as prose literals that nothing checked. `@object-ui/types` publishes nothing from
`__tests__/` — the package `tsconfig.json` excludes the directory by name, and the build
program lists zero files under it — so no published behaviour changes.
