---
'@object-ui/components': minor
---

BREAKING (`@object-ui/components`): the chart primitives — `ChartContainer`,
`ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
`ChartStyle` and the `ChartConfig` type — are removed. `@object-ui/plugin-charts`
is the single implementation (objectui#7397, maintainer ruling 2026-09-04).

**Migration: import the chart primitives from `@object-ui/plugin-charts`.**

(The bump is `minor` by this repo's release model — objectui's major is pinned to
the `@objectstack` family major, and its own breaking changes ship as `minor` with
the break spelled out here, per `scripts/check-changeset-no-major.mjs`. This
paragraph is that spelling-out: the break below is real and consumer-visible.)

- **What breaks, by specifier**: `import { ChartContainer, ChartTooltip,
  ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle } from
  '@object-ui/components'` and `import type { ChartConfig } from
  '@object-ui/components'` no longer resolve — TS2305 at build time, `undefined` at
  runtime. They were reachable through two `export *` hops (`src/index.ts` →
  `./ui` → `./chart`), so this is a real removal from the published surface, not a
  tidy-up of dead code.
- **Not affected**: `ChartSkeleton` — the chart-area loading placeholder in
  `src/custom/view-skeleton.tsx` — is a different symbol and stays exported.
  `@objectstack/spec/ui` still owns the authored-chart `ChartConfig`; only the
  per-series style map published from this package is gone. `@object-ui/plugin-charts`
  calls its own map `ChartContainerConfig`, so the two names no longer collide.
- **Why the copy had to go rather than be fixed in place**: it duplicated
  `packages/plugin-charts/src/ChartContainerImpl.tsx` and carried the
  label-resolution hole objectui#7248 had already fixed there. `ChartLegendContent`
  resolves a label as `config[nameKey || item.dataKey || 'value']` while rendering
  the colour swatch unconditionally, so a legend entry whose config lookup misses
  paints an anonymous coloured dot — on a scatter that reads as a data point drawn
  outside the plot area, which is exactly how objectui#7248 was reported. Two copies
  of one primitive is how a fixed bug returns; consumers importing from
  `@object-ui/components` were getting the unfixed one.
- **Why not re-export the plugin's copy from here instead**: `@object-ui/plugin-charts`
  depends on `@object-ui/components` (`workspace:*`), so the dependency direction
  forbids it.
- **Consumer census**: zero in-repo importers, measured with a lit control — no file
  under `apps/**`, `examples/**` or `packages/**` imported any of these names from
  `@object-ui/components`. `plugin-charts` reaches its own copy by relative path.
  The `hotcrm` and `cloud` repositories could not be read from the seat that made
  this change (HTTP 403), so no claim is made about them.

`packages/components/shadcn-components.json` records `chart` under
`customComponents` with `movedToPlugin: "@object-ui/plugin-charts"`, which is what
keeps `pnpm shadcn:update-all` from re-fetching the primitive and silently undoing
this.
