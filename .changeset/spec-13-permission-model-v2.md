---
'@object-ui/app-shell': major
'@object-ui/components': patch
'@object-ui/console': patch
'@object-ui/types': patch
---

Adopt `@objectstack/spec` 13 (ADR-0090 Permission Model v2) across the workspace.

Every workspace package now depends on `@objectstack/spec` ^13.0.0 — the v2 major that renames role → position (D3), removes the profile concept (D2), makes OWD default to `private` when unset (D1), and drops the legacy `read`/`read_write`/`full` sharing aliases (D4). UI fallout fixed in the same sweep:

- **clientValidation**: the `role` draft-schema loader is now `position` → `PositionSchema` (fixes the `RoleSchema does not exist` build break, #2365); the dead `profile` loader is removed (D2).
- **Studio previews**: `RolePreview` → `PositionPreview` (flat — positions carry no hierarchy; the old parent-chain breadcrumb and "assign to a Profile" copy are gone). Legacy `role`/`profile` preview keys stay registered for pre-v2 backends.
- **OWD control** (`ObjectSettingsPanel`): removed the now-dead alias normalization (spec 13 rejects the aliases at authoring time) and the amber "fully public" warning — an unset sharing model now defaults to Private (D1), and the copy says so in both locales.
- **Fallback schemas / anchors / samples**: `position` replaces the hierarchical `role` fallback schema; `isProfile` dropped from the permission create-anchor and previews samples; permission-set viewer no longer renders a profile badge; console System hub counts `sys_position` instead of the removed `sys_role`.
- **Studio i18n**: type labels `Role/角色` → `Position/岗位`, `profile` label removed, Access-pillar heading and sharing copy rewritten to the v2 vocabulary.
- `@object-ui/types` now exports `SubmitBehavior` (was defined but missing from the public surface, breaking `@object-ui/plugin-form`'s re-export under a clean build).
- **External OWD dial (D11)**: the object Settings sharing card gains an `externalSharingModel` select (portal/partner baseline) with an inline wider-than-internal warning mirroring the publish-time lint.
- **Permission matrix OWD badges**: every object row now shows its record-level baseline (`OWD Public read`, `Ext Private`, or `OWD Private (default)` for the D1 fail-closed unset case) so grant edits carry their record-reach context.

The flow designer's approval assignee `role` kind is intentionally unchanged — spec 13 keeps it as the sole D3 exception (better-auth `sys_member.role` org-membership tier).
