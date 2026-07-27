---
"@object-ui/core": patch
"@object-ui/plugin-charts": patch
"@object-ui/plugin-dashboard": patch
---

fix(dashboard,charts): send widget `dateGranularity`/`sortBy`/`limit` to the query, and give funnels a real stage order (framework#3588)

`DatasetWidget` never read `widget.options`. Four keys an author writes there
change the query the server compiles, so a widget declaring
`options: { dateGranularity: 'month' }` grouped by the raw timestamp and drew
one bar per record, and `sortBy`/`sortOrder` produced no ordering at all.

- `DatasetWidget` lowers `options.dateGranularity`, `options.sortBy` +
  `options.sortOrder`, and `options.limit` into the `DatasetSelection` it posts.
  A `sortBy` naming something the widget does not project is dropped rather than
  sent, so a stale sort key left by an edit degrades to "unordered" instead of
  failing the widget against the server's stricter validation. These keys also
  join the refetch signature, so editing one in the designer refetches instead
  of re-rendering the previous grid.
- Funnel stages follow a **declared order**. `AdvancedChartImpl` sorted funnel
  segments by value descending, unconditionally — which overrode any server
  ordering and rendered a sales pipeline as a tidy narrowing shape whatever the
  stages' real sequence, hiding the very anomaly (a bulge at Proposal) the chart
  exists to show. It now honours a `categoryOrder`, which `DatasetWidget`
  derives from the dimension field's picklist option order — the pipeline order
  an author already declared on the object — or from an explicit
  `options.stageOrder`. With no declared order the value-descending default is
  unchanged, and a category missing from the order is kept (after the declared
  ones), never dropped.
- New `@object-ui/core` helpers `buildCategoryOrder` / `buildCategoryRank`,
  keyed by both the stored value and the display label like the existing
  `buildOptionColorMap`, so ordering works whether or not the server resolved
  the dimension's labels.

Requires the framework-side fix in objectstack#3588 for the selection keys to
take effect server-side.
