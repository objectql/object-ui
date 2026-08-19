---
'@object-ui/plugin-report': patch
---

A report's embedded chart now paints its category dimension's own option colours and renders ordered-sequence charts (funnel/pyramid) in the field's declared picklist order — the same two derivations a dashboard chart has always gotten for the identical dimension (objectui#4906).

`DatasetReportChart` (`DatasetReportRenderer.tsx`) resolved its dimension's option **labels** but called neither `buildOptionColorMap` nor `buildCategoryOrder` — the two `@object-ui/core` helpers `DatasetWidget` (plugin-dashboard) already runs off the same resolved field metadata. The chart forwarded only an author-supplied `colors` record (objectui#4877); with none authored it fell back to the positional palette, and a funnel's stages sorted by value instead of the declared pipeline.

This is convergence onto an already-ruled behavior, not new capability: the report path now runs the identical `useDatasetDimensionMeta` → `localizeFieldOptions` → `buildOptionColorMap`/`buildCategoryOrder` chain the dashboard widget uses (framework#3588's declared-picklist-order ruling), reused rather than re-derived.

**This visibly changes rendering for an existing report** that groups by a select/lookup dimension carrying option colours, or is declared on an ordered field:

- a chart with no authored `colors` now paints each category in that dimension's own option colour (e.g. a `health` dimension now paints its own green/amber/red) instead of the renderer's positional palette;
- a `funnel`/`pyramid` chart now orders its stages by the field's declared picklist order instead of sorting by value.

Precedence is unchanged and preserved: an authored `colors` record (objectui#4877) still wins over the derived per-category map, merged UNDER it exactly as the dashboard already does — an author's explicit colour for a category is never overridden by the field's own.
