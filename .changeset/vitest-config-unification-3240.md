---
---

Repo tooling only — no published behaviour changes.

objectui#3240 deletes the 17 per-package `vitest.config.ts` files (plus
`examples/schema-catalog`'s) so the root `vitest.config.mts` is the repo's single
test config, and rewrites every package `test` script to reach it by path filter
(`vitest run --root ../.. <pkgdir>/`). The three files this touches under a
released package's `src/` are COMMENTS in test files, each naming a config or
setup file this change deletes; no runtime or type surface moves. The collected
test population is byte-identical before and after — 2459 (project, file) pairs,
diffed programmatically.
