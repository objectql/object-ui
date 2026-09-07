---
---

Test-only: 13 test files under `packages/*/src` built a repo path out of the
process cwd, so they reached a different verdict under their package's own
`test` script (`vitest run --root ../.. packages/PKG/`, which is what
`pnpm --filter PKG test` and `turbo run test` run) than under the repo-root form
CI runs — `--root` moves vitest's root and leaves `process.cwd()` in the package
directory (objectui#7799).

Nothing ships: no runtime source changed, and no package is released by this
change. The root is now derived from each test file's own `import.meta.url`,
copying the precedent landed for objectui#7791, so every one of them reaches the
same verdict under both invocations.

Readings for the whole class, one tree, cwd the only variable — 17 files /
373 tests:

- repo root: 373 passed / 0 failed before, 373 passed / 0 failed after
- package dir: 325 passed / 48 failed before, 373 passed / 0 failed after

`pnpm --filter @object-ui/components test`, the acceptance invocation, goes from
1 file / 6 tests red to 233 files / 2166 tests green.
