---
"@object-ui/console": patch
"@object-ui/plugin-detail": patch
---

Retire `permission_change`, `export`, and `restore` from the audit-log action filter (`AuditLogPage`'s `ACTION_OPTIONS`) and badge maps (`AuditLogPage` and `HistoryTimeline`'s `ACTION_VARIANT`). These three values never had a writer anywhere on the platform, so the filter always returned zero rows for them and the badges never rendered — a visible product defect (audit surface should be narrow-but-honest, not broad-but-lying). `import`, `login`, and `config_change` are kept: `import` has a real writer (`plugin-auth`'s `admin-import-users.ts`) and is still declared by the server enum and filtered by the `config_changes` list view; `login`/`config_change` gained real writers in objectstack#8144/#8145.
