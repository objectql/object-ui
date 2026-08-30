---
'@object-ui/plugin-report': patch
'@object-ui/cli': patch
---

`@object-ui/plugin-report` now registers its three components under namespace
**`plugin-report`**, the spelling its consumers already declare (objectui#6416).

It used to register `report`, `spec-report` and `report-viewer` under namespace
`report`, while `apps/console` declared the lazy stubs for the same three short
names under `plugin-report` and the CLI's known-type whitelist shipped the
`plugin-report:*` spellings as renderable. Two things followed from the
disagreement:

- **`plugin-report:report`, `plugin-report:report-viewer` and
  `plugin-report:spec-report` could never be satisfied.** `Registry.register`
  clears the lazy stub for the type IT registers, and that type was
  `report:report`, so those three stubs were never cleared and no component was
  ever stored under them: `get('report', 'plugin-report')` returned `undefined`
  and `hasLazy('report', 'plugin-report')` stayed `true` forever. A schema
  authored with any of the three whitelisted keys resolved to nothing — the
  gate handed authors a green light for a key the runtime could not satisfy.
- **The bare `report` key was claimed twice under two different namespaces.**
  `Registry.register` and `Registry.registerLazy` share the
  `meta?.namespace && !meta?.skipFallback` branch, so what bare `report`
  *declared* depended on whether the plugin chunk had loaded yet — the
  objectui#6353 shape.

**No authored metadata changes.** The direction was chosen by measurement:
nothing in this repository, and nothing in the sibling `objectstack` checkout,
authors a `report:*` spelling (0 hits), while the bare spellings are authored in
48 places. `type: 'report'`, `type: 'spec-report'` and `type: 'report-viewer'`
resolve exactly as before; the three unreachable `report:*` keys are retired and
the three `plugin-report:*` keys now name real components for the first time.

`packages/cli/src/utils/known-schema-types.ts` is regenerated from the
registrations, dropping `report:report`, `report:report-viewer` and
`report:spec-report`.

Two pins are the half that outlives the fix:
`packages/plugin-report/src/__tests__/report-bare-key-ownership.test.ts` replays
this package's real declared metadata and a console-shaped lazy stub into a
fresh `Registry` in **both** registration orders, checking the bare key's
declared namespace after every step, so order- and phase-independence are
properties under test rather than properties of the file the test imports.
`scripts/__tests__/report-namespace-agreement-6416.test.ts` re-derives both
sites from source and fails if the plugin, the console stubs and the generated
whitelist ever disagree again.
