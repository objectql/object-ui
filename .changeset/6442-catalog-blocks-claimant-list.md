---
---

Comment-only truthfulness fix in the docs-site gallery host,
`apps/site/app/components/registerCatalogBlocks.ts`. Its `IMPORT ORDER IS CONTRACT`
note justified the import order with a bare-keyword claimant list naming two packages
that do not claim the key: it said bare `chart` is claimed by `plugin-charts`,
`plugin-dashboard` and `plugin-report`. Re-derived with the repo's own
`deriveRegistryKeys` (`scripts/check-doc-component-types.mjs`), bare `chart` has one
package claimant, `plugin-charts` — `plugin-dashboard` registers `dashboard`,
`dashboard-grid`, `metric`, `metric-card`, `object-data-table`, `object-metric`,
`object-pivot` and `pivot`, `plugin-report` registers `report`, `spec-report` and
`report-viewer`, and neither registers `chart` at all. The two `apps/console` sites
that also hold the key are `registerLazy` stubs whose loader is `@object-ui/plugin-charts`
itself, which `Registry.register` drops unconditionally once the real component arrives,
so they are placeholders for that package rather than competing claimants of the keyword.

The same re-derivation extends the correction to the `calendar` half the issue had not
checked in depth: bare `calendar` likewise has one package claimant, `plugin-calendar`,
because `@object-ui/components` registers the date-picker primitive as `ui:calendar`
with `skipFallback: true` precisely so it does not take the bare keyword. The note
therefore no longer opens by asserting that several packages register the same bare
keyword — measured across the workspace, no bare key is claimed by two of the thirteen
packages this file imports. The mechanism (last registration of a bare keyword wins) and
the reason the order stays fixed are kept. No code, no imports and no assertions changed,
and no published behaviour changes.
