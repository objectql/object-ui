---
"@object-ui/app-shell": patch
---

feat(app-shell): A4 — permission-provenance tri-state badge (framework#2920)

The Studio permission-matrix editor's provenance badge was two-state
(package / custom). It is now a **tri-state — platform / package / admin(custom)**,
mirroring the unified `sys_*.managed_by` vocabulary landed in framework#2920 so
the Studio matrix and the Setup record page read the same source-of-truth
labels.

- `PermissionMatrixEditor` — `managedBy === 'platform'` renders a **Platform**
  badge; `'package'` (or an active `packageId`) renders **Package**; everything
  else (including legacy `'user'`) falls through to **Custom**.
- New `perm.badge.platform` i18n key (en + zh-CN).

The Setup record page surfaces provenance via the framework object's now-`select`
`managed_by` field (rendered by the generic record renderer), so no record-page
change is required here.
