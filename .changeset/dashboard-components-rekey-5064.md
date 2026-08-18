---
'@object-ui/plugin-dashboard': major
---

BREAKING: `dashboardComponents` is re-keyed from 11 PascalCase component class
names to the 8 schema `type` keys the package actually registers
(`dashboard`, `metric`, `metric-card`, `object-metric`, `pivot`,
`object-pivot`, `dashboard-grid`, `object-data-table`), aligning the map with
its four sibling `*Components` maps (objectui#5064, Route A per the
2026-08-18 maintainer ruling). Every value is the exact component the
side-effect import registers for that type — for the two `object-*` types
that is the internal data-source-gate wrapper, not the exported widget. The
three config-panel components (`DashboardConfigPanel`, `WidgetConfigPanel`,
`DashboardWithConfig`) leave the map; they remain named exports. Any code
reading the old keys (e.g. `dashboardComponents.DashboardRenderer`) breaks —
two independent word-boundary greps measured zero such consumers in-tree.
The maintainer authorized a one-PR exception to `check-changeset-no-major`
for this re-key; the `major` score here is that exception.
