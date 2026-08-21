---
'@object-ui/core': patch
'@object-ui/fields': patch
'@object-ui/plugin-charts': patch
---

The value-fallback label prettifier `humanizeLabel` has one implementation instead of two byte-identical copies.

`humanizeLabel` turns a stored value into a display string when nothing else
resolves it — an option with no declared label, an object name, a chart axis
member. It existed twice, byte for byte: once in `@object-ui/fields` (read by
`plugin-grid`, `plugin-gantt`, `plugin-detail` and by that package's own
renderers) and once as a deliberate local copy in `plugin-charts`'
`ObjectChart.tsx`, whose comment said it was there "to avoid a dependency on
`@object-ui/fields`".

Two copies of one convention is a live hazard rather than tidiness: one
dashboard can hold a chart and a grid over the same stored value, so a change
landing on one copy alone would put that value on screen under two spellings at
once. The single implementation now lives in `@object-ui/core` — the shared
ancestor both packages already depend on, so the dependency the copy existed to
avoid is still avoided and no new edge is created, and core takes no React
(objectui#4389: core-canonical logic, plugins consume). Both former sites
re-export it, so `import { humanizeLabel } from '@object-ui/fields'` keeps
working unchanged.

**Nothing rendered changes.** The surviving implementation is byte-identical to
both deleted copies, and each former call site is pinned by identity against the
core function — not by a copied output table that someone would have to remember
to edit in two places.

The core module also writes down, for the first time, why this convention stays
distinct from `humanizeFieldKey` (the KEY fallback, in `@object-ui/plugin-dashboard`),
which additionally splits camelCase:

```
input                humanizeFieldKey     humanizeLabel
needs_analysis       Needs Analysis       Needs Analysis
NeedsAnalysis        Needs Analysis       NeedsAnalysis        <- differ
unitPrice            Unit Price           UnitPrice            <- differ
BestCase             Best Case            BestCase             <- differ
lost-to-competitor   Lost-To-Competitor   Lost To Competitor   <- differ
```

A field KEY is authored in the codebase and carries a machine spelling, so
splitting camelCase recovers words its author meant. A stored VALUE is arbitrary
tenant data, where a mid-token capital is not reliably a word boundary and
splitting it rewrites what the tenant wrote (`McDonald` to `Mc Donald`). The two
conventions also do not nest — on the last row each leaves alone the separator
the other rewrites. Whether they should ever converge is a separate decision
that would move rendered output in four packages at once; it is deliberately not
made here.
