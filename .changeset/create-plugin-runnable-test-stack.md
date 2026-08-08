---
'@object-ui/create-plugin': patch
---

create-plugin: make the scaffolded plugin's own test suite runnable

The generator wrote an example test importing `@testing-library/react` and
asserting with `toBeInTheDocument()`, plus a `test: 'vitest run'` script, while
declaring neither library and giving Vitest no DOM environment — so `pnpm test`
in a freshly scaffolded plugin failed on the very first run, at import
resolution.

The generated `package.json` now declares `@testing-library/react`,
`@testing-library/jest-dom` and `jsdom` (each range copied from this
monorepo's own manifest), the generated `vite.config.ts` gains a `test` block
with `environment: 'jsdom'`, `globals: true` and `setupFiles`, and a
`vitest.setup.ts` registering the jest-dom matchers is written alongside it.
The templates moved to `src/templates.ts` so the generated artifacts can be
pinned by unit tests without executing the CLI.
