---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/react": minor
---

chore(deps): upgrade `@objectstack/*` to 17.0.0-rc.0, and let the spec take back what it now owns

`spec` / `client` / `formula` / `lint` move from `^16.x` to `^17.0.0-rc.0`. Two
groups of v17 changes reach this repo, and they pull in opposite directions —
the spec pruned surface objectui re-exported, and adopted surface objectui had
been carrying locally.

**The spec pruned dead Theme config (objectstack#3494), so the re-exports went
with it.** `ThemeSchema` dropped `spacing`, `breakpoints`, `logo`, `density`,
`wcagContrast`, `rtl`, `touchTarget` and `keyboardNavigation` — authorable but
never enforced, so authoring them was already a silent no-op. `@object-ui/types`
re-exported those sub-schemas *by reference* (issue #2231), so they could not
survive the prune without becoming hand-written mirrors — exactly the second
de-facto contract AGENTS.md #0.1 forbids. Removed from the public surface:

- Types: `Spacing`, `Breakpoints`, `DensityMode`, `WcagContrastLevel`,
  `ThemeLogo`, and the deprecated `SpacingScale` alias
- Schemas: `SpacingSchema`, `SpacingScaleSchema`, `BreakpointsSchema`,
  `ThemeLogoSchema`, and the `SpacingSchemaType` / `BreakpointsSchemaType` helpers
- `Theme.spacing`, `Theme.breakpoints` and `Theme.logo`

`mergeThemes` no longer merges the three dropped keys. `generateThemeVars` is
unaffected — it never emitted them, which is why the liveness audit called them
dead. The one real consumer was `ThemeProvider`, which set the favicon from
`theme.logo.favicon`; that path is gone, because v17 strips the key at parse and
it could never arrive again. The live favicon is unaffected: it comes from
operator branding (`getFaviconUrl()`), applied in the console's `index.html`,
`main.tsx`, and on route change.

Nothing else read the pruned types. In particular the list-density feature is
untouched — `useDensityMode` and `rowHeightToDensityMode` use `@object-ui/core`'s
own local `DensityMode`, which never came from the spec.

**The spec adopted objectui's ListColumn extensions (objectui#2231), so the
extension collapsed.** `ListColumnSchema` used to `.extend()` the spec with two
fields, each carrying a note to promote it upstream rather than grow the
extension; v17 did exactly that. `summary` is now the spec's
`union([ColumnSummarySchema, ColumnSummaryConfigSchema])` — the same enum ∪
`{ type, field }` form `useColumnSummary` reads — and `prefix` is the spec's
`ColumnPrefixSchema`. `ListColumnSchema` is now a plain by-reference re-export.
One behavior change rides along: `prefix.type` defaults to `'text'` on parse
instead of staying `undefined`, so the cell renderer always gets a value.

**Node 22 is now the floor.** Every `@objectstack` package declares
`engines.node: ">=22.0.0"` (objectstack#3825; Node 20 reached EOL 2026-04-30).
This repo claimed `>=20` and ran CI on Node 20.x, so it promised — and validated
— a runtime its own core dependency does not support. `engines.node` is now
`>=22`, CI runs Node 22.x, and the CI/deployment docs say so.

The major stays 17: per AGENTS.md the major tracks `@objectstack`'s major, which
is also 17, and that convention deliberately outranks semver purity — so the
removals above ship as a minor rather than desyncing the two.
