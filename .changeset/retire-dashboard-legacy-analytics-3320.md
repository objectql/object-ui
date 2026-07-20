---
"@object-ui/types": minor
"@object-ui/plugin-dashboard": minor
"@object-ui/plugin-designer": minor
---

feat(dashboard): retire the pre-ADR-0021 inline-analytics renderer branches (framework#3320)

Follow-up to the dashboard analytics migration (framework#3251 / objectui#2703).
Authoring already emits only the semantic-layer shape (`dataset` + `dimensions` +
`values`); this removes the renderer's now-unauthored legacy read-branches.

- **types**: drop the `@deprecated` inline-analytics keys (`object`,
  `categoryField`, `categoryGranularity`, `valueField`, `aggregate`, `measures`)
  from `DashboardWidgetSchema`. They were retained in #2703 only so the renderer
  could read legacy/static metadata during the transition.
- **plugin-dashboard**: `DashboardRenderer` no longer emits the object-bound
  metric / chart / pivot / table / list branches from the top-level `object` +
  analytics keys. It keeps the renderer-internal static paths (`options.data` /
  `widget.data` array and the `provider: 'object'` async config) and
  `widget.component`. The dashboard renderer no longer emits `object-pivot` /
  `pivot` at all — dataset pivots render through `DatasetWidget` (grouped table /
  cross-tab); the `ObjectPivotTable` / `PivotTable` components stay as public
  SDUI blocks for other surfaces. `DashboardGridLayout` gets the same treatment.
- **graceful fallback**: a widget that still carries the retired inline shape in
  stored metadata (top-level `object`, no `dataset`, no inline `options.data`)
  now renders a visible error placeholder prompting a rebind to a dataset, rather
  than a blank chart/grid.
- **plugin-designer**: `DashboardEditor` drops its inline object / value-field /
  aggregate fields (analytics binding is authored via the dataset picker in
  app-shell's `DashboardWidgetInspector` / plugin-dashboard's `WidgetConfigPanel`).
