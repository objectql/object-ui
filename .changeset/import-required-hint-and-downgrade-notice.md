---
"@object-ui/plugin-grid": patch
---

Import wizard: stop leaving the user at two silent dead-ends (surfaced during framework batch-write testing).

- #2640 — the mapping step now renders an inline hint listing every required field that has no column mapped (as `label (name)`), so a disabled **Next** button always explains itself. The hint updates live with the mapping and clears once the columns are supplied; the disable logic itself is unchanged.
- #2639 — when the server `/import` route is unavailable and the wizard downgrades to the legacy per-row `create` loop, the completion screen now shows a "compatibility fallback" notice (values written as-is, without server-side coercion) via a new optional `ImportResult.degraded` flag — the downgrade is no longer silent. The pre-existing guard that refuses the fallback when relation columns are mapped (which would otherwise write raw natural keys into FK columns) is retained.
