---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/plugin-dashboard": minor
"@object-ui/plugin-report": patch
---

feat(dashboard): dashboard-level filters (date / region) driving multiple charts (framework#2501)

A dashboard's `dateRange` + `globalFilters` declarations are now wired end to
end: the filter values live as dashboard-level variables (the page variables
primitive, so they're also readable as `page.<name>` in widget expressions),
a filter bar renders above the widgets, and at render time the dashboard
broadcasts the active values into every bound widget's inline query —
`AND`-merged with the widget's own `filter`. Charts stay inline and
self-contained; each widget maps a filter to **its own** field.

- **`@object-ui/types`** — `globalFilters[].name` (stable filter/variable key,
  defaults to `field`) and `DashboardWidgetSchema.filterBindings`
  (`Record<string, string | false>`: per-widget field override / `false`
  opt-out). Zod mirrors included. **Pending paired `@objectstack/spec`
  alignment (framework#2501)** — same precedent as `dataset` /
  `categoryGranularity`.
- **`@object-ui/core`** — new pure `dashboard-filters` module
  (`resolveDashboardFilterDefs`, `dashboardFilterVariableDefs`,
  `buildFilterCondition`, `buildWidgetScopedFilter`); `mergeFilters` lifted
  from plugin-report (re-exported there unchanged). Date presets emit
  date-macro tokens (`{30_days_ago}` …) so widgets resolve them at query time
  like hand-authored filters.
- **`@object-ui/plugin-dashboard`** — `DashboardFilterBar` (date presets +
  custom range calendar, select with static `options` or `optionsFrom`,
  text/number inputs, reset); `DashboardRenderer` mounts a
  `PageVariablesProvider` when filters are declared and merges the
  widget-scoped condition into inline widgets' `filter` and dataset widgets'
  `runtimeFilter`. Dashboards without filters render exactly as before.

Binding precedence: explicit `filterBindings` string/`false` → legacy
`targetWidgets` allow-list → the filter's own `field` (dateRange defaults to
`created_at`). Static-data widgets are not filtered.
