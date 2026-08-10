---
'@object-ui/console': patch
---

Declare the retired `system/{users,organizations,roles,positions}` console URLs as redirects onto the framework-owned system objects (objectui#3655).

`SystemHubPage`'s cards and both sidebars' `sys-*` cluster emit five `/apps/setup/system/…` targets. Four of them were real routes until `apps/console` was slimmed for third-party customisation, which deleted the bespoke wrapper pages because "these objects are now contributed by framework plugins … and resolved via the generic `/apps/setup/<object_name>` route" — but the producers were never retargeted and nothing redeclared the URLs. All five fell through to app-shell's tail, where the failure they got depended on how long the word was, because `ShorthandRecordRedirect` treats any URL-safe segment of 6+ characters as a record id:

- `users` (5) and `roles` (5) rendered "Page not found".
- `organizations` (13) and `positions` (9) were rewritten to `…/system/record/<word>` and rendered a record detail page for an object literally named `system` — the worse of the two, because it reads as a backend/data problem rather than a dead link.

Each now forwards in one hop to the object the framework's own Setup navigation names: `sys_user`, `sys_organization` (the list entry — the record-scoped one needs a runtime `{current_org_id}` a static redirect cannot resolve), and `sys_position` for both `roles` and `positions` (ADR-0090 D3 renamed `sys_role` to `sys_position`, so the sidebar's "Roles" and the hub's "Positions" are one surface in two vocabularies). Same shape as the `system/objects` and `system/metadata` redirects beside them: the URL is translated, the deleted page is not resurrected, and the navigation producers are untouched.

`system/permissions` is deliberately left as it was. The framework splits what this console calls "Permissions" into two Setup entries — `sys_capability` and `sys_permission_set` — and picking one here would silently commit every click and bookmark to a surface nobody chose. Its unchanged landing is pinned in the tests so the gap stays visible.
