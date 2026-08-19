---
'@object-ui/types': patch
---

Removed the dead `require` condition from `exports["."]` in `@object-ui/types`'s `package.json`. It pointed at `dist/index.cjs`, a file the package's `"build": "tsc"` script (bare `tsc`, no bundler) structurally never emits — verified on a clean rebuild (`rm -rf dist tsconfig.tsbuildinfo && tsc`): zero `.cjs` files under `dist/`.

**Judged non-breaking (`patch`), because the condition never resolved to anything a consumer could depend on** — measured both ways from a real `require()` call through the package's own resolved workspace symlink (not asserted):

- **Before this change**: `require('@object-ui/types')` → `MODULE_NOT_FOUND: Cannot find module '.../dist/index.cjs'` (the condition existed but its target was never written by the build).
- **After this change**: `require('@object-ui/types')` → `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined ...` (no matching condition).

Both throw. No working `require()` call is turned into a failing one — there was no working one to begin with, in this repo or in any published version, since the build has never emitted `dist/index.cjs`. The `import` condition (`./dist/index.js`, real and always present) and the `types` condition are unchanged.

The package declares `"type": "module"` and ships no bundler, so ESM-only is the contract-honest shape going forward; adding a second build format to satisfy a condition nothing used was the alternative and was not taken.
