---
'@object-ui/plugin-dashboard': patch
'@object-ui/app-shell': minor
---

Dashboard: don't show a currency symbol on a KPI that never asked for one, and move dashboard authoring entirely into Studio.

A data-bound metric widget (`ObjectMetricWidget`) used to backstop an unspecified currency with the tenant default (`localization.currency`, ADR-0053), so a `currency`-typed field with no declared code rendered as e.g. `US$2,528,600` even though nothing on the dashboard named a currency. Metrics now show a currency **only** when it is explicitly specified — the widget's own `currency` prop or the aggregated field's declared code (`currency` / `currencyConfig.defaultCurrency` / `defaultCurrency`) — and otherwise render a plain number. (Field/cell renderers keep the tenant-default backstop; only KPIs changed.)

The in-page dashboard **Edit** button and its inline `DashboardConfigPanel` were removed — `DashboardView` is now a pure viewer. Authoring lives in one place: Studio's Interfaces pillar. The top bar's "Design in Studio" icon is now context-aware — on a dashboard route it deep-links straight to that dashboard's design page (`/studio/:packageId/interfaces?surface=dashboard:<name>`) via the new `appStudioSurfacePath` helper, falling back to the package's Data tab elsewhere.
