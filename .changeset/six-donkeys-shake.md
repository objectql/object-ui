---
---

Test-only change to three `apps/console` test files: the `vi.mock('@object-ui/app-shell', …)`
factories no longer call `importOriginal()`, which was transforming the whole source-aliased
barrel graph (measured 10019 ms per file) to reach a handful of real exports. They now spread
only the app-shell submodules those exports live in. No published behaviour changes.
