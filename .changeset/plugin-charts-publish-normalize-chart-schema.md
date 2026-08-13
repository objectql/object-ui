---
'@object-ui/plugin-charts': minor
---

Publish `normalizeChartSchema` from the package entry.

`normalizeChartSchema` is the single place the author-facing chart schema is translated into the renderer's internal pipeline contract, and `ChartRenderer` calls it on every render. It was not reachable from the package's only entry point, so a consumer that wanted to assert what `AdvancedChartImpl` is actually handed had to restate the translation rather than run it. It is now exported from the entry, along with the `NormalizedChartSchema` type it returns.

Additive only: nothing is removed or renamed, and the module was already in the entry's eager import graph via `ChartRenderer`, so this publishes a name rather than shipping new bytes.
