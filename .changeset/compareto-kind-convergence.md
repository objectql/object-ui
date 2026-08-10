---
"@object-ui/core": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-charts": patch
---

Converge dashboard widget `compareTo` on the executor's `{ kind, dimension? }` contract, and make the dataset path actually render a comparison

`CompareToConfig` was a three-branch union (`'previousPeriod' | 'previousYear' | { offset }`). `@objectstack/spec` collapsed it to the shape the analytics executor already implements — `DatasetCompareTo`, a plain strict object `{ kind: 'previousPeriod' | 'previousYear'; dimension?: string }` (objectstack#5011) — so this renderer now reads that one shape:

- `shiftFilterByCompareTo` / `compareToTrendLabelKey` dispatch on `compareTo.kind`. The `{ offset }` duration shift is gone: `{ offset: '1y' }` is `kind: 'previousYear'`, while `'7d'` / `'1M'` have no faithful target and are restated by the author on the widget's own `filter` plus `kind: 'previousPeriod'`. No trend label key is retired — the offset arm resolved to `vsPreviousPeriod`, which survives as the `previousPeriod` fallback.
- `DatasetWidget` no longer discards part of `compareTo`. It used to forward only the object form because the two string forms had no meaning downstream; with one shape there is nothing to discard, and a stale string is now invalid metadata rejected where it is authored rather than silently reinterpreted here.
- **The comparison now actually runs on the dataset path.** A widget states its window in its own `filter` (a date macro, or the dashboard date-range filter merged in), but the executor shifts a `timeDimensions` entry carrying a `dateRange` — so a dataset widget asking for a comparison got "compareTo needs a dated window to shift" and rendered none. When (and only when) a comparison is requested, the resolved filter's bounded date windows are lowered into `selection.timeDimensions[].dateRange` and moved out of `runtimeFilter` (a copy left behind would intersect the shifted window with the current one and empty every comparison column). Which dimension gets shifted stays the executor's decision: every window found is lowered under the name the author wrote, and zero or two candidates surfaces the executor's own error, listing them.
- The `<measure>__compare` columns that come back are now shown: a delta + window label on KPI widgets, a comparison column on tables, and a `variant: 'comparison'` overlay series on charts — the same treatment and the same `dashboard.trend.*` labels the inline object-provider widgets already use.
