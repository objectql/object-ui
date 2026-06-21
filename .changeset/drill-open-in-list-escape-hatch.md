---
"@object-ui/react": patch
"@object-ui/types": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-charts": patch
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

feat(dashboard): drill "Open in list" escape hatch + unify report drill

Adopts the mainstream BI peek-then-escalate drill model. Drill-through opens an
in-place drawer (keep context) and offers an "Open in list →" affordance to
escalate to the object's full list page (sort / bulk-select / export / shareable
URL) — the Looker / Power BI "see records → open in page" pattern.

- New `DrillNavigationContext` (`@object-ui/react`): the app shell provides
  `openRecordList`; the renderer stays decoupled from console routing.
- The drill drawers (pivot / dataset / chart / KPI) render the escape hatch when
  a host navigation handler is present, and hide it otherwise (self-contained
  peek). `DashboardView` provides the handler via `useOpenRecordList`.
- `DrillDownConfig.target` gains `'navigate'` — skip the drawer and open the
  list directly; degrades to `'drawer'` when no host handler is available.
- `ReportView` drill-through now opens the same in-place drawer (peek records →
  click a row to open a record) instead of navigating away; the escape hatch
  preserves the previous navigate-to-list behavior. Dashboard and report drill
  are now unified.
- i18n: `dashboard.openInList` (en / zh).
