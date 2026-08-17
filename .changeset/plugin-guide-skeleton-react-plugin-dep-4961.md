---
---

Docs + test-only (objectui#4961). The plugin skeleton in `content/docs/guide/plugins.md`
contradicted itself across two adjacent steps: step 5 writes `vite.config.ts` with
`import react from '@vitejs/plugin-react'` and calls `react()` in `plugins`, while step 6's
`devDependencies` never declared that package — the import on step 5 was its only mention on
the page. A reader following the numbered tutorial 1 through 6 therefore reached their first
`pnpm build` with a config importing something they were never told to install, and the
build failed while resolving the third line of the config. Fixed by declaring
`"@vitejs/plugin-react": "^6.0.5"` in step 6, the range all 19 in-repo
`packages/plugin-*` manifests declare unanimously.

Same defect the closed objectui#3716 and #3742 fixed on the `create-plugin` generator side
(a generated artifact declaring a usage without declaring its dependency); this
hand-written page teaches the same thing and was never walked alongside them.

The new literal is anchored rather than merely recorded: it joins
`scripts/__tests__/doc-version-claims.test.ts` as a third `anchored` entry carrying
`skeletonDep`, which objectui#3855's derived floor was built to absorb without a new
mechanism, so the next toolchain bump turns the gate red naming that page. Two things on the
same block were checked and deliberately left alone — the `peerDependencies` `react` range
(what a copied plugin accepts from its host, which its author owns) and the absence of
`vite-plugin-dts` (the skeleton emits declarations with `tsc --emitDeclarationOnly`, so it
needs no dts plugin even though all 19 plugin manifests carry one). The assertion judges the
range of a dependency the page already names; it never demands the page name every
dependency the manifests do.
