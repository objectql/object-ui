---
"@object-ui/react": major
---

refactor(spec-bridge): remove the dead page/dashboard bridges (#1892)

`SpecBridge`'s `page` and `dashboard` bridges — `bridgePage`, `bridgeDashboard`,
and the `SpecBridge#transformPage` / `#transformDashboard` methods — had no
runtime consumer. Pages render through their own renderer and dashboards
through `DashboardView → DashboardRenderer → DatasetWidget` (ADR-0021); neither
path routes through `SpecBridge`. The dashboard bridge's input shape
(`object` / `categoryField` / `valueField` / `aggregate`) is the pre-ADR-0021
widget model, which the strict `DashboardWidgetSchema` now rejects — so the
bridge could not receive a spec-valid dashboard even in principle.

Flagged dead by the metadata-liveness audit (framework #1878 / #1892). The
`list` and `form` bridges are unaffected and remain the live authoring path.

BREAKING CHANGE: the public exports `bridgePage`, `bridgeDashboard`, and the
`SpecBridge#transformPage` / `#transformDashboard` methods are removed. There
is no replacement — render pages and dashboards through their renderers
(`DashboardRenderer` / the page renderer) directly.
