---
"@object-ui/types": major
"@object-ui/app-shell": patch
"@object-ui/plugin-form": patch
"@object-ui/plugin-grid": patch
---

fix(fls): wire the real per-caller FLS channel into import targets and grid
columns; remove the never-populated `field.permissions` shape (objectstack#3661)

The `permissions?: { read?, write?, edit? }` key on `@object-ui/types` field
definitions (Phase 3.2.6) was declared-but-never-enforced: no producer in the
stack ever populated it, so every guard reading it short-circuited to "allow".
Per ADR-0049 enforce-or-remove, the shape is deleted and the three consumers
now use the server-resolved `/auth/me/permissions` channel
(`usePermissions().checkField`) — the same channel ObjectForm/ModalForm/ListView
already enforce:

- **ImportWizard target fields (app-shell `ObjectView`)**: the importable
  field set (and thus the downloadable CSV template's columns) now drops
  fields the caller cannot edit, instead of offering columns the server's
  FLS write gate would 403.
- **ObjectGrid auto-derived columns**: columns the caller cannot read are
  dropped (same gate ListView applies), instead of a dead schema-shape check.
- **ObjectForm**: the redundant dead guard in field generation is removed;
  the existing `applyFieldPerms` gate remains the real enforcement point.

BREAKING CHANGE: `@object-ui/types` field definitions no longer accept a
`permissions` key. It never carried data at runtime; consumers needing
per-caller field-level permissions must use `@object-ui/permissions`
(`MePermissionsProvider` + `useFieldPermissions`/`checkField`).
