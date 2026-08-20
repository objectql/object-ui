---
---

Test tooling only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared.

`assertCanonicalVitestInvocation` refuses a package-cwd Vitest run because such a run uses
a different config than CI does, so its green says nothing about CI. Its docstring claimed
that "every per-package `vitest.config.ts` re-exports the root config, and a package
without one resolves upward to it, so no package-level path skips this file". Measured, by
running `pnpm exec vitest run` from every directory that carries a config: 8 package
configs import the root config and were refused, 2 packages carry no config and resolve
upward and were refused, and **11 standalone configs never mention the root file at all**
(`plugin-calendar`, `-charts`, `-detail`, `-form`, `-gantt`, `-grid`, `-kanban`, `-list`,
`-map`, `-timeline`, `-view`) — nothing imported the guard from there, so it never ran.
From `packages/plugin-grid`, one such run printed `Test Files 1 passed (1)` /
`Tests 5 passed (5)` and exited 0, under a config carrying no `@object-ui/*` alias table
at all where the root config maps ~40 specifiers at sibling `src/`. The guard's hole sat
exactly where the divergence — and therefore the false-green risk — was largest.

Those 11 configs now call the guard themselves, through a new
`repoRootFrom(import.meta.url)` landmark search rather than a hand-counted `../..` (which
resolves to a real directory when the count is wrong, so the guard would keep issuing
verdicts computed against the wrong root). The docstring and the root config's call-site
comment now describe the three routes a config can take instead of asserting one of them,
and the claim is enforced rather than restated: the guard's own test walks every
`vitest.config.*` in the repo and fails on any that takes neither route.

No package `src/` is touched and the configs' test semantics are unchanged, so no
`@object-ui/*` package changes behaviour and there is nothing here for a consumer to
upgrade to.
