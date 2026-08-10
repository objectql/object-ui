---
'@object-ui/console': patch
---

Count System Hub's Organizations card through `sys_organization`, the object the framework actually registers — it asked for `sys_org`, which does not exist, so the card read `0` on every deployment (objectui#3670).

The failure was silent by construction. A missing object answers `404 OBJECT_NOT_FOUND`, and `ObjectStackAdapter.find()` absorbs that on purpose — it caches the name in `missingResources` and resolves `{ data: [], total: 0 }` so callers can treat an uninstalled collection as "no rows". The hub renders `data.length`, so a name the framework never had produced a perfectly ordinary `0`, indistinguishable from a workspace that genuinely has no organizations — which no single-org deployment ever is, since `sys_organization` always holds at least one row. The `.catch` on each call never even saw the 404; it only ever covered non-404 rejections.

The other three counted names were checked against the framework's object registry and are correct as spelled: `sys_user`, `sys_position`, `sys_audit_log`.

The Permissions card is **not** fixed here and still reads `0`. Its query names `sys_permission`, which the framework also does not have — it splits that surface into `sys_capability` (lineage: its own docblock says "named `sys_capability`, not `sys_permission`") and `sys_permission_set` (function: the admin-managed grant container). Both would render, so choosing one would silently bind the card to a surface nobody picked; that decision is open on objectui#3655. Until it lands the gap is held visible by a MEASUREMENT case in the page's test rather than quietly re-aimed.
