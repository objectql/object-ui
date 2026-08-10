---
"@object-ui/runner": patch
---

Complete `packages/runner/vite.config.ts`'s workspace alias table to the full
transitive import closure, so `@object-ui/runner` boots and builds from the
monorepo sources without a prior `pnpm -w build` (objectui#3575).

The table aliased 7 `@object-ui/*` specifiers to `packages/*/src`, but those
`src` trees import 8 more workspace packages that were not aliased. Those fell
back to Node resolution and landed on `packages/<pkg>/dist`, which does not
exist in a fresh install-only checkout — so the "From Source" flow documented in
`content/docs/utilities/runner.mdx` (`pnpm install` then `pnpm dev`, no build
step) failed with "Failed to run dependency scan" and served HTTP 500 for every
module on the chain. `pnpm --filter @object-ui/runner build` failed the same way.

Newly aliased: `i18n`, `sdui-parser`, `react-runtime`, `fields`, `plugin-detail`
(first layer), `providers` and `permissions` (only reachable once the first layer
resolves to src), and `data-objectstack` (a type-only import that esbuild erases,
so the dependency scan never reported it).

This is user-visible in the published artifact, because the alias table is not
scoped by `command` and therefore applies to `vite build` as well. Bundling the
newly aliased packages from src stops the per-icon `lucide-react/dynamic.mjs`
chunks from being inlined, so the build now emits ~1.7k lazy icon micro-chunks
like `apps/console` does. `build.modulePreload` is disabled to match console, so
those chunks are not all preloaded on first paint: the measured initial eager
payload drops from 4231003 to 591795 bytes, while total `dist` size grows about
5.5% because the previously inlined icons are now separate files.
