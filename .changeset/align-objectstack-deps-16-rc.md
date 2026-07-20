---
"@object-ui/types": patch
"@object-ui/core": patch
"@object-ui/app-shell": patch
"@object-ui/data-objectstack": patch
"@object-ui/react": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-form": patch
"@object-ui/plugin-gantt": patch
"@object-ui/plugin-map": patch
"@object-ui/plugin-timeline": patch
"@object-ui/plugin-tree": patch
"@object-ui/plugin-view": patch
"@object-ui/console": patch
---

chore(deps): align every `@objectstack/*` dependency to `^16.0.0-rc.0`

Bumps `@objectstack/spec` / `client` / `formula` / `lint` from `^15.1.1` to the
`16.0.0-rc.0` pre-release across the workspace (root + `apps/console` +
`apps/site` + all consuming packages). ObjectUI's own packages are already on
major 16, so this closes the 15↔16 skew between ObjectUI and the `@objectstack`
contract libraries (which publish in lockstep with `spec`).

This is a dependency alignment, not a behavioral migration: the full workspace
build (43/43) and the `@objectstack`-consuming package test suites
(`core` / `app-shell` / `data-objectstack` / `plugin-form` / `types`) are green
against `16.0.0-rc.0` with no source changes required.

Practical effect: `@objectstack/client@16.0.0-rc.0` now ships
`data.batchTransaction` (framework #3271), so `ObjectStackAdapter`'s feature
detect (`typeof client.data.batchTransaction === 'function'`) routes
master-detail cross-object saves through the typed SDK method instead of the
raw `fetch('/api/v1/batch')` fallback — realizing the "verify SDK path" half of
#2694. The raw-fetch branch stays as a defensive fallback (removal tracked in
#2694).
