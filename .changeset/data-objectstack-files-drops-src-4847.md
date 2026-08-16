---
'@object-ui/data-objectstack': patch
---

`@object-ui/data-objectstack` stops publishing its `src/` tree

The manifest's `files` array listed `src` alongside `dist`, so every published tarball carried all 43 source files — 38 of them `*.test.ts`. It had been that way since the package's first commit (`780a1b993`), never added for a consumer, and objectui#4006 recorded the same shape without acting on it: its scope was the `*.test.d.ts` half that the build program emitted into `dist`, and its own triage note graded this half as tarball weight rather than a break.

Nothing in the published surface reached those files, which is why no consumer changes in either direction. Measured on a cleanly rebuilt `dist`, all four ways in are closed: the `exports` map has one entry (`.`) and every condition under it targets `dist`; `main` / `module` / `types` are `./dist/index.js`, `./dist/index.js`, `./dist/index.d.ts`; the repo and the docs teach only the root specifier, and no `@object-ui/data-objectstack/src/...` deep import exists anywhere (the `src` paths in sibling `vite.config.ts` / `vitest.config.mts` files are workspace aliases resolved through `path.resolve()` against the source tree, which no `files` array shapes); and the tarball holds no sourcemap that could point back at `src`, since `tsup.config.ts` sets `sourcemap: false` and its bundled `dts` writes no `.d.ts.map` — the built `dist` contains four files, zero `.map` among them, and zero occurrences of `sourceMappingURL` or `../src/`.

`npm pack --dry-run` across the change, on the same `dist`:

| | before | after |
| --- | --- | --- |
| entries | 51 | 8 |
| unpacked | 1356830 B | 719876 B |
| tarball | 393379 B | 222157 B |

43 files leave, none arrives, and every surviving entry is byte-identical apart from the edited `package.json`: `dist/index.{js,cjs,d.ts,d.cts}`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`. The 43 are the 38 tests plus the five modules they cover (`index.ts`, `errors.ts`, `metadata-client.ts`, `userState.ts`, `cache/MetadataCache.ts`), whose published form remains the bundled `dist/index.js`.
