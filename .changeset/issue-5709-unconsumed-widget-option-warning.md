---
'@object-ui/sdui-parser': minor
---

`validateTree` now reports a dashboard widget `options` key that no renderer
consumes as a `unconsumed-widget-option` **warning** naming the consumed set
(objectui#5709 ruling). The census behind the accepted set — the spec's five
declared query keys (`dateGranularity`, `sortBy`, `sortOrder`, `limit`,
`stageOrder`) plus the `description` sub-caption convention key — is
re-measured on every test run against `@objectstack/spec` and the
`plugin-dashboard` renderer sources. The check fires only on dataset-bound
shorthand widgets (the spec-legal form) hosted by `dashboard` /
`dashboard-grid` nodes, and honours the spec's per-widget
`suppressWarnings: ['unconsumed-widget-option']` escape hatch. Warning
severity only: documents keep parsing, saving and rendering. Exported for
other surfaces: `checkDashboardWidgetOptions`, `CONSUMED_WIDGET_OPTION_KEYS`,
`DASHBOARD_WIDGET_HOST_TYPES`, `UNCONSUMED_WIDGET_OPTION`.
