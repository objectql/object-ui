---
"@object-ui/app-shell": minor
---

Migrate the runtime DashboardView "dashboard editor" onto the studio's spec-driven inspectors. A single app-shell `DashboardConfigPanel` now replaces both legacy `plugin-dashboard` panels (the dashboard-level config panel and the per-widget config panel): with no widget selected it hosts a new spec-driven `DashboardDefaultInspector` (registered as the studio default inspector for the `dashboard` type), and with a widget selected it hosts the existing `DashboardWidgetInspector`. Both inspectors edit the full nested Dashboard document directly, so the runtime's widget flatten/unflatten adapters are removed. The panel lives in app-shell to avoid a circular dependency on plugin-dashboard; the `sys_dashboard` persistence path is unchanged.
