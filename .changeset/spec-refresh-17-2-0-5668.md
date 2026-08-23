---
'@object-ui/console': patch
---

Refreshes the lockfile so every `@objectstack/*` package resolves at `17.2.0` — `spec`, `client`, `core`, `formula`, `lint` and `sdui-parser` move in lockstep (a split resolution is what produced the dual-version spec graph that reddened `check:spec-symbols` in this repo's history), and no `17.1.0` resolution remains.

**The docs-site and console builds stop pulling a Postgres connection-string parser toward the browser bundle.** `@objectstack/spec@17.1.0` imported `pg-connection-string` at the top level of `dist/index.mjs` with no `browser` export condition, so `apps/site`'s production build failed with `Module not found: Can't resolve 'fs'` on every route that reaches `@object-ui/components` from a client component — red on `main` since 2026-08-22 (objectui#5668). `17.2.0` ships the objectstack#11072 fix: `.`, `./data`, `./system`, `./kernel` and `./cloud` now carry `browser` conditions pointing at schema-free `dist/browser/**` bundles, and the site build is back to `Tasks: 29 successful, 29 total`.

The refresh is lockfile-only — every manifest already declared `^17.0.0`, which admits `17.2.0`, so no dependency range changed. No shipped source moves: the two in-repo adaptations are a drift-guard test and a CI gate, both forced by `17.2.0` retiring the spec's theme module (objectstack#10485) exactly as the objectui#5716 localization predicted — its `Theme`/`ThemeMode`/`ColorPalette` ALLOW entries in `check:spec-symbols` went stale and were deleted, and the parity test now pins the vacancy (the spec re-publishing a theme name is a loud collision) instead of a spec leg that no longer exists.
