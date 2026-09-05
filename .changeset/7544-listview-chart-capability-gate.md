---
'@object-ui/plugin-list': patch
---

The list view's capability gate now resolves `chart` (objectui#7544).

A `grid` list view that declared a complete `chart:` block and whitelisted
`appearance.allowedVisualizations: ['grid', 'chart']` was never offered the Chart
toggle. `availableViews` builds the resolvable set from each visualization's binding
and intersects it with the whitelist (ADR-0047, whitelist ∩ resolvable); seven
visualizations had a capability check there — kanban, gallery, calendar, timeline,
gantt, map, tree — and `chart` had none, so the author's own whitelist was filtered
down to nothing and the view fell back to `['grid']`. `chart` entered the offered set
only through the "always allow switching back to the schema's own viewType" leg, i.e.
only when the view was already `viewType: 'chart'`.

Both halves were spec-legal and authorable the whole time: `chart` is a
`VisualizationTypeSchema` switcher target and `chart:` is a list-view key
(`ListChartConfigSchema`). Only the gate never asked. This is `map`'s objectui#5042 one
visualization over, and is fixed the same way.

**What now resolves.** A chart block that binds to names the author wrote: the ADR-0021
shape (`dataset` plus at least one measure in `values`), or the legacy inline shape (a
declared category — `xAxisField` / `categoryField` — together with a declared measure —
`yAxisFields[0]` / `valueField`), in the view-level `chart` block or the legacy
`options.chart` bag. A block that declares no binding stays unoffered: reaching the
renderer with nothing declared lands on the legacy branch's invented `'name'` /
`'value'` floor, and the switcher must not offer a route into it. That floor itself is
unchanged here (objectui#7547).

The gate and the `case 'chart'` render branch now read ONE resolver
(`resolveListChartBinding`) rather than two copies of the condition, so they cannot
drift about what a usable chart block is. `schema.chart` also joins the memo's
dependency array, so a block that arrives on a later render is seen.
