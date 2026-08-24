---
"@object-ui/types": minor
"@object-ui/plugin-designer": patch
"@object-ui/app-shell": patch
---

Close the dashboard widget `type` vocabulary, and admit `metric-card` as objectui's own component extension.

`DashboardWidgetSchema.type` was `string` on the TypeScript interface and `z.string()` in the Zod twin — an unbounded hatch. A typo'd family, a chart type the spec retired, and a component type nothing registers all type-checked and validated, surfacing only as the renderer's red `OBJUI-001` panel at runtime.

It is now the CLOSED `DashboardWidgetTypeName` / `DashboardWidgetTypeSchema`: the spec's own `ChartTypeSchema` families **by reference**, plus two named, closed objectui extension sets — `DASHBOARD_WIDGET_TYPE_EXTENSIONS` (`list`, `custom`: objectui-only widget families) and `DASHBOARD_COMPONENT_WIDGET_TYPES` (`metric-card`: an objectui SDUI **component** type the widget slot holds directly, per the maintainer ruling of 2026-08-14 — objectui's own component enum, explicitly not the spec widget enum).

Three drifts the closure surfaced and this change fixes: the dashboard designer's palette offered `grid`, which is not a widget family in either contract and was refused at publish; the metadata-admin widget inspector and the designer both wrote an unvalidated `string` from their select boxes; and a `@object-ui/types` fixture pinned `bar-chart`, a `plugin-charts` component type, on a dataset-bound widget that could never render as one.
