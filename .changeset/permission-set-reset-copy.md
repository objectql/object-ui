---
"@object-ui/app-shell": patch
---

Say "reset to shipped baseline" instead of "delete" when removing a package-owned permission set (ADR-0094).

Deleting a `sys_permission_set` row whose `managed_by === 'package'` doesn't remove it — the backend drops the environment customization overlay and resets the set to its shipped baseline, so the row stays in the list. The confirmation dialog and success toast now say so (with `resetPackageSetConfirm` / `resetPackageSetSuccess` i18n, en + zh), instead of promising an irreversible delete the user can see doesn't happen. Environment-authored sets keep the plain delete copy. The grid row-delete passes the record through so the check needs no extra fetch; the SDUI header delete falls back to a `findOne` lookup.
