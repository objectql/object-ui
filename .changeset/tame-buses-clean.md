---
---

Test-only change to `@object-ui/types`' zod-mirror parity ledger: the `WiderThanDeclared` operator can now tell a `z.record(z.string(), V)` mirror from a partial record over a finite key union (objectui#8517). No published type, mirror or runtime behaviour moves — the file is under `src/__tests__/`, which `packages/types/tsconfig.json` excludes from the emitting build.
