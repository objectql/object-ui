---
"@object-ui/app-shell": minor
---

Migrate the runtime ReportView "report editor" onto the studio's spec-driven inspector. The right-rail editor now hosts the same report inspector the metadata studio uses (config fields sourced from `@objectstack/spec` `ReportSchema` / `reportForm`) instead of plugin-report's legacy `buildReportSchema` / `ConfigPanelRenderer` engine, so runtime and studio share one report-editing surface. A new spec-driven `ReportDefaultInspector` is registered as the studio default inspector for the `report` type, and a thin app-shell `ReportConfigPanel` hosts it for the runtime (kept in app-shell to avoid a circular dependency on plugin-report). Field pickers read from the in-memory object definition (no extra network fetch); the `sys_report` persistence path is unchanged.
