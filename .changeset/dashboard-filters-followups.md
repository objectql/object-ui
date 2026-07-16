---
"@object-ui/i18n": patch
"@object-ui/types": patch
---

Dashboard-level filters follow-ups (#2578, framework#2501):

- **i18n**: the `DashboardFilterBar` strings now ship as real locale entries —
  `dashboard.filters.*` (bar label, "All time", "Custom…", "All", "Reset",
  and the 13 date-range preset labels) added to `en` and `zh`. Previously the
  bar always rendered the `useSafeTranslate` English fallbacks.
- **types**: `GlobalFilterSchema.name` and `DashboardWidgetSchema.filterBindings`
  landed in `@objectstack/spec` (framework#2501), so the local type
  annotations flip from "Pending alignment" to "Aligned" — no shape changes.

Also adds five schema-catalog examples (`plugin-dashboard/filtered-dashboard-*`:
dynamic `optionsFrom` options, text/number/lookup filter types, dataset +
inline widget mix, `targetWidgets` allow-list, date presets + custom range)
and a new "Dashboard-Level Filters" guide page covering the full tutorial,
`page.*` expression usage, and known limitations with workarounds.
