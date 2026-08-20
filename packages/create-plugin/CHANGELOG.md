# @object-ui/create-plugin

## 17.6.0

### Patch Changes

- 195b9e4: A scaffolded plugin's generated manifest now asks for the same `@testing-library/jest-dom` range this repo installs.
  
  `src/templates.ts`'s `DEV_DEPENDENCIES` had fossilised one patch behind the repo
  root: the template said `^7.0.0` while the root manifest had moved to `^7.0.1`.
  `templates.test.ts`'s anchor rule caught it and was red on `main`.
  
  Same defect class, same day and same dependabot wave as the `lucide-react` drift
  in `@object-ui/cli`'s app generator, so both templates move together here — which
  is how the previous occurrence of this incident was handled too (objectui#4098 /
  PR objectui#4099 moved these same two templates in one PR). This one came from
  the dev-dependencies group bump rather than the single-package bump, and it was
  found only because the two ratchets live in different packages: the anchor rule
  throws on its first mismatch, so nothing reports the second template until the
  first is green.
  
  The remaining seven anchored ranges in this template were swept against the same
  wave and are all in sync.

## 17.5.0

## 17.4.0

### Patch Changes

- e473b6c: Anchor the scaffold's build-side `devDependencies` to this repo's real toolchain, and pin the whole generated manifest against drift

  A freshly scaffolded plugin declared a build stack one to two majors behind the one this monorepo actually builds and tests every in-tree plugin with: `vite ^7.3.1` against the repo's `^8.2.0`, `@vitejs/plugin-react ^4.2.1` against `^6.0.5`, `vite-plugin-dts ^4.5.4` against `^5.0.3`, `typescript ^5.9.3` against `^6.0.3`, `vitest ^4.0.18` against `^4.1.10`. Those five ranges were never sourced from anything — objectui#3716's end-to-end run of the generated artifact only ever exercised the versions installed in this repo, so the declared ranges were not the ones under test. All five now quote an in-repo anchor, the same way the three testing ranges already did.

  Two anchors, because the root manifest does not declare everything. `create-plugin` writes into `<cwd>/packages/plugin-<name>`, so a generated plugin is a literal sibling of `packages/plugin-*`; those manifests anchor the two build-only tools the root omits (`@vitejs/plugin-react`, `vite-plugin-dts`), and the root anchors the rest.

  The parity test now covers **every** entry of the generated `devDependencies` rather than the three testing ones, including a completeness check that fails when a dependency is added without naming its anchor — the five build ranges drifted precisely because nothing pinned them. It also asserts the two anchors agree wherever both declare a dependency, so which one is read cannot hide a drift.

  The generated `vite.config.ts` resolves its library entry from `import.meta.dirname` instead of `__dirname`. vite 8 still defines `__dirname` under its default `bundle` config loader but warns on it ("unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite ... Use `import.meta.dirname` instead"), and under `native` — which imports the config with Node's own ESM loader, where no `__dirname` exists — the generated config failed to load outright. `apps/console/vite.config.ts` was converted for the same reason in objectui#3384.

  Not a peer-dependency fix: `@vitejs/plugin-react ^4.2.1` resolved to 4.7.0, whose vite peer had widened to `^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` and accepted the declared `vite ^7.3.1`, so the old manifest installed cleanly. The cost was a scaffold lagging its own monorepo, not a failing install.

- f4f42b4: create-plugin: make the scaffolded plugin's own test suite runnable

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

- c852682: Remove the scaffold's unused pinned icon dependency, and make its generated schema interface reachable

  Two declared-but-unreachable artifacts in the generated plugin, both on the blind side of
  the import gate objectui#3733 added — that gate rejects an import nothing declares, and
  never looked for a declaration nothing imports.

  **The generated `dependencies` no longer pin `lucide-react`** (objectui#3755). It was
  declared at `^0.563.0` and imported by no generated source file, so every freshly
  scaffolded plugin really installed lucide 0.563.x for code that never referenced it — two
  majors behind the 23 in-repo declarations, all `^1.28.0`. Worse than ordinary caret drift:
  a `0.x` caret does not cross minors, so `^0.563.0` is `>=0.563.0 <0.564.0` and could not
  float even within `0.x`. It is removed rather than re-anchored because this repo declares
  an icon library where it imports one — of the 24 manifests mentioning `lucide-react`, 23
  import it, and none pre-declares it for code not yet written. An author who wants icons
  runs `pnpm add lucide-react` and lands the current version by construction, with no anchor
  table to maintain for an unused entry. The generated `dependencies` is now exactly the four
  `workspace:*` platform packages, which cannot drift at all.

  **The generated `src/index.tsx` now re-exports the schema interface** from `src/types.ts`
  (objectui#3759). The generated `exports` map exposes exactly one key — `.` — so the entry
  is a consumer's only door, and nothing walked through it to `src/types.ts`: no generated
  source imported it, and the deep paths that would have reached it (`<pkg>/types`,
  `<pkg>/dist/types`) are closed by that same map. The interface in it is the plugin's schema
  contract, and it shipped dead — while the generator's own documentation page told authors to
  "export your schema types … make it importable rather than internal". A named type-only
  re-export, matching the four in-repo plugins that ship a `src/types.ts` and the worked
  example in the plugin-development guide.

  **That interface now extends `BaseSchema` from `@object-ui/types`** instead of re-declaring
  a subset of the base node. Unreachable, a hand-rolled `{ type; id?; className? }` was only
  dead weight; published, it would be a second dialect of a node the protocol already defines,
  silently missing everything else `BaseSchema` carries (`name`, `label`, `visible`, …). Only
  the `type` literal is narrowed locally, the same shape every in-repo plugin uses. This also
  makes the generated `@object-ui/types` dependency a used declaration.

  Both halves are pinned structurally rather than by string match, so the next dead artifact
  fails a test instead of shipping: no versioned runtime dependency may be declared that no
  generated source imports (`workspace:*` exempt — it cannot drift), and no generated `src/**`
  module may be unreachable from the single entry the `exports` map exposes. Each of those
  gates passes over an empty result on today's templates, so each is paired with a self-test
  that plants the removed defect back and asserts the rule names it — a gate that is green
  because it produces nothing is not a gate.

- c29ceff: Move the generator templates' dependency ranges onto the repo's current ones

  The dependabot wave of 2026-08-10 bumped `lucide-react` to `1.29.0` and `vite`
  to `8.2.1` in this repo's own manifests, but the ranges hard-coded in the
  scaffold generators do not move with it — dependabot does not know the
  templates exist. A project scaffolded by `objectui init` / `objectui dev` or by
  `create-plugin` therefore declared a range the repo itself had already moved
  past.

  Three ranges are re-anchored: `lucide-react` `^1.28.0` → `^1.29.0` in the routed
  app generator, and `vite` `^8.2.0` → `^8.2.1` in both the shared CLI scaffold
  devDependencies and the create-plugin template.

## 17.3.0

## 17.2.0

## 17.1.0

## 17.0.0

### Patch Changes

- 5b9cf96: fix(plugin-map): drop the `maplibre-gl@6` default import, and put type-check behind a CI gate that cannot be silently skipped (#2911)

  `maplibre-gl@6.0.0` removed its default export (arrived via #2848, dependabot),
  so `ObjectMap.tsx`'s `import maplibregl from 'maplibre-gl'` has been a TS1192
  error on `main` for a day. The binding was never used — the map instance comes
  from `react-map-gl/maplibre`, and the stylesheet from the side-effect import on
  the next line — so the import is simply deleted rather than rewritten to
  `import * as`.

  Removing it is runtime-neutral, which the issue had explicitly left unverified.
  `@vis.gl/react-maplibre` (what `react-map-gl/maplibre` re-exports) does
  `Promise.resolve(mapLib || import('maplibre-gl'))` in `components/map.js`, so it
  loads the library itself when no `mapLib` prop is passed. Verified in a browser
  against the `store-locator-map` catalog schema: `maplibre-gl` is fetched as its
  own lazy chunk, the WebGL canvas comes up 800x600, and all three markers mount —
  byte-identical probe output with and without the static import. That also matches
  what `apps/console/src/main.tsx` already intends, where the plugin is registered
  lazily specifically to keep `maplibre-gl` out of the initial bundle.

  **The reason it survived a day of green CI is the part worth fixing.** No
  workflow ran `type-check` at all, and `turbo build` only checks types for
  packages whose `build` script happens to invoke `tsc` — the 22 `vite build`
  packages transpile without checking. A sweep of all 45 packages found ten with
  broken types, `plugin-map` merely being the one that had a script to notice it.

  Adding a `pnpm type-check` job alone would not have been a gate: **turbo silently
  skips any package with no `type-check` script**, so 17 packages read as passing
  because nothing ran. With `plugin-map` fixed, `pnpm type-check` reports 63/63
  green while nine packages are still broken. So:

  - `plugin-ai` and `plugin-report` gain the `paths` override their type-checked
    peers already carry, which detaches workspace deps from sibling _source_ and
    resolves them through built `.d.ts` — the sole cause of the 104-error TS6059
    `rootDir` floods, and the same trick their own `vite.config.ts` already applies
    to the dts program.
  - Seven packages gain `"type-check": "tsc --noEmit"` (`plugin-ai`,
    `plugin-report`, `plugin-dashboard`, `create-plugin`, `console`, and the two
    console examples). Coverage goes 28 -> 35 of 45.
  - New `scripts/check-type-check-coverage.mjs` makes the invisibility impossible:
    a package with no `type-check` script must be declared, with a reason, and the
    lists only shrink — gaining a script without deleting the entry fails the
    guard. The nine known-broken packages are recorded there with error counts
    (`@object-ui/runner` has no `tsconfig.json` at all), tracked as follow-ups.
  - New `Type Check` CI job runs the coverage guard first (instant, no install),
    then `pnpm type-check`.

  Both halves were proven to fail before being trusted: the guard was exercised in
  all four of its failure modes, and re-introducing the `maplibre-gl` import turns
  the job red again, as does a fresh error injected into `plugin-ai` — a package
  that had no type checking whatsoever before this change.

## 16.1.0

## 16.0.0

## 15.0.0

## 14.1.0

## 14.0.0

## 13.2.0

## 13.1.0

## 13.0.0

## 12.1.0

## 12.0.0

## 11.5.0

## 11.4.0

## 11.3.0

## 11.2.0

## 11.1.0

## 7.3.0

## 7.2.0

## 7.1.0

## 7.0.0

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.4

## 6.0.3

## 6.0.2

## 6.0.1

## 6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

## 5.2.0

## 5.1.1

## 5.1.0

## 5.0.2

## 5.0.1

## 5.0.0

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

## 4.4.0

## 4.3.1

## 4.3.0

## 4.2.1

## 4.2.0

## 4.1.0

## 4.0.12

## 4.0.11

## 4.0.10

## 4.0.9

## 4.0.8

## 4.0.7

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## 4.0.1

## 4.0.0

## 3.4.0

## 3.3.2

## 3.3.1

## 3.3.0

## 3.2.0

## 3.1.5

## 3.1.4

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

## 3.0.2

## 3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0
