---
'@object-ui/react': minor
---

refactor(spec-bridge): retire the spec-bridge — `SpecBridge`, `bridgeListView`, `bridgeFormView` (#6366)

Removed under the 2026-08-27 maintainer ruling on #6366 (Option A — remove, and
for `SpecBridge` as a WHOLE, not just the form half), on the same criteria the
17.0.0 entry used to remove `bridgePage` / `bridgeDashboard`: no runtime
consumer, and a route that could not deliver a working result even in
principle. The stage-1 measurement (2026-08-26, PM-verified) the ruling rests
on:

- **Zero consumers at every reachable endpoint** — no non-test caller in this
  repo, none in the sibling `objectstack` repo (which does not depend on
  `@object-ui/react` at all), and a GitHub-wide public code search returning
  hits only inside this repository. External npm-private hosts are
  unmeasurable from here; the ruling records fallback C (keep + document the
  boundary) should evidence of one ever surface.
- **The bridged form route was structurally unable to work**: a bridged node
  carries neither `objectName` nor `customFields`, so `ObjectForm` takes the
  branch its own code labels "cannot proceed" and renders, in the registry
  wrapper's words, "a field-less card in silence". The only working host
  recipe (`{...node, objectName: '...'} as any`) existed solely inside the
  list bridge's integration tests and was documented nowhere.

This knowingly reverses the 17.0.0 changelog line "The `list` and `form`
bridges are unaffected and remain the live authoring path" — by maintainer
ruling, on the same measurement criteria that entry itself applied.

#5898's restored-key work on the form-view bridge (the
`FormViewSpecConformance` suite and the spec keys it carried onto the bridged
node) is **superseded by this removal, not fixed** — the route it repaired is
gone. #6366's measured type-vocabulary asymmetry (a bridged field carrying
`text` where the normalizer produces `field:text`) is likewise mooted rather
than repaired.

The suites pinning the removed route go with it — retirement of a route
nothing travels, not quarantine: the seven suites under
`react/src/spec-bridge/__tests__/`, and plugin-grid's
`specBridgeColumnSpelling` / `specBridgeExportFormats` render-integration
suites. `ObjectGrid`'s own column-spelling, export-gate and density behavior
keep their non-bridge pins (`columnDeclaredSpellingOnly`, `exportGate`,
`exportServer`, `rowHeightOffSpecBoundary`, and core's
`normalize-list-view` suite).

BREAKING CHANGE: the public exports `SpecBridge`, `bridgeListView`,
`bridgeFormView` and the types `BridgeContext` / `BridgeFn` / `ObjectDefLite`
are removed from `@object-ui/react`. There is no replacement translation
layer — author `object-grid` / `object-form` nodes directly (the live path is
`app-shell`'s `ObjectView`, which builds them from the object's own metadata),
exactly as the 17.0.0 entry already directed for pages and dashboards.
