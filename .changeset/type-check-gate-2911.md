---
"@object-ui/plugin-map": patch
"@object-ui/plugin-ai": patch
"@object-ui/plugin-report": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/create-plugin": patch
"@object-ui/console": patch
---

fix(plugin-map): drop the `maplibre-gl@6` default import, and put type-check behind a CI gate that cannot be silently skipped (#2911)

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
  peers already carry, which detaches workspace deps from sibling *source* and
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
