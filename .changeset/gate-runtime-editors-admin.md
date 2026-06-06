---
"@object-ui/app-shell": patch
---

Gate the runtime report and dashboard editors behind an admin check. Editing a report or dashboard mutates the **shared** definition (it writes the single `sys_report` / `sys_dashboard` record, not a per-user copy), but the edit buttons were shown to every user — so any viewer could change a report/dashboard for everyone. The "Edit" affordance (and its config panel) is now admin-only, matching ObjectView's existing view-config gate. This is the first step of ADR-0034 (runtime edits are an admin quick-edit of the shared definition).
