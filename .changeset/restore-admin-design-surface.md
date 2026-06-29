---
'@object-ui/app-shell': patch
---

fix(app-shell): restore admin design surface gated on the removed `user.role='admin'` overwrite

ADR-0068 (a3a5abff8) stopped the server `customSession` from overwriting
`user.role = 'admin'` for workspace owners/admins — canonical roles now arrive
in `user.roles[]` (`org_owner` / `org_admin`) with `user.isPlatformAdmin` as a
derived alias, and `useIsWorkspaceAdmin()` was introduced to read them. Four
runtime views were missed in that migration and still gated their admin design
tools on the now-defunct `user?.role === 'admin'`, so workspace owners/admins
silently lost:

- **ObjectView** — the list "+ New view" button plus rename/delete/pin/
  set-default/config/manage-views and the view config panel.
- **PageView / DashboardView / ReportView** — the inline "Edit"/config entry
  points for the shared page / dashboard / report definitions.

All four now call `useIsWorkspaceAdmin()` (same helper already adopted by
AppSidebar, UnifiedSidebar, HomePage, Marketplace…). No behavior change for
genuine platform admins; restores the surface for org owners/admins.
