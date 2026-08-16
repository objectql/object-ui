---
'@object-ui/fields': patch
---

`@object-ui/fields` stops publishing its `src/` tree

The manifest's `files` array listed `src` alongside `dist`, so every published tarball carried all 173 source files — 97 of them `*.test.tsx` / `*.test.ts`. It has been that way since the file's first commit (`780a1b993`), where `files` was already `["dist", "src", "README.md"]` while `exports` named only `dist`, so the entry was never added for a consumer. objectui#4006 recorded this exact shape and did not act on it: its scope was the `*.test.d.ts` half the build program emitted into `dist`, and it noted in passing that the test sources were already in the tarball by this other route.

Nothing in the published surface reached those files, which is why no consumer changes in either direction. Measured on a cleanly rebuilt `dist`, all four ways in are closed: the `exports` map has two entries and both target `dist` (`.` resolves `types` / `import` / `require` to `./dist/index.d.ts` / `./dist/index.js` / `./dist/index.cjs`, and `./style.css` to `./dist/index.css`); `main` / `module` / `types` are `./dist/index.cjs`, `./dist/index.js`, `./dist/index.d.ts`; no deep import into this package exists anywhere in the repo or the docs — the one that used to, `@object-ui/fields/widgets/MarkdownContent`, was ruled out by objectui#4325 precisely because a package's surface is its index, and the `../fields/src` paths in sibling `vite.config.ts` files are workspace aliases resolved through `resolve()` against the source tree, which no `files` array shapes; and the tarball holds no sourcemap that could point back at `src`. That last one is the check that had to be measured rather than assumed, because this package emits its declarations through `vite-plugin-dts` rather than the `tsup` of objectui#4847 or the bare `tsc` of `@object-ui/types`: a clean rebuild writes 78 files into `dist`, of which zero are `.d.ts.map`, zero are `.js.map`, zero contain a `sourceMappingURL` comment and zero mention `../src`. `src/index.css` is an input to `scripts/build-css.mjs`, not an output anyone resolves; the sheet the `./style.css` export names is the built `dist/index.css`, which still ships.

`npm pack --dry-run` across the change, on the same `dist`:

| | before | after |
| --- | --- | --- |
| entries | 255 | 82 |
| unpacked | 2265557 B | 841772 B |
| tarball | 629843 B | 252364 B |

173 files leave, none arrives, nothing outside `src/` moves, and every surviving entry is byte-identical apart from the edited `package.json` itself. The 173 are the 97 tests plus 76 implementation modules, whose published form remains the bundled `dist/index.js` / `dist/index.cjs` and the 75 declaration files beside them.

`@object-ui/types` keeps its `src` entry for now, and that is a different judgement rather than an omission: it builds with a bare `tsc` under a `declarationMap` / `sourceMap` config with no `inlineSources`, so its shipped `dist/*.d.ts.map` name `../src/*.ts` with no embedded content and dropping `src` there would leave published maps pointing at files the tarball no longer carries. That trade-off is filed as objectui#4851.
