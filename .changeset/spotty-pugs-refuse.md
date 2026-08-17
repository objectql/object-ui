---
'@object-ui/permissions': patch
---

Permission reads no longer throw on a config that omits the required `roles`
member. `ObjectPermissionConfig.roles` is declared required, but a config
arriving from plain JS or from metadata loaded at runtime can omit it, and
`objectConfig.roles[roleName]` then threw a `TypeError` out of `check()` and
took the whole render down — the failure mode the evaluator's own note already
forbids (`a permission check must never be able to crash a render`).

`evaluatePermission` now treats a missing `roles` as granting nothing: no role
resolves, and the call returns the ordinary `allowed: false` denial. The
`publicAccess` channel is evaluated before this and is unchanged. The three
matching reads in `PermissionProvider` (`checkField`, `getFieldPermissions`,
`getRowFilter`) are guarded the same way and keep their own documented
defaults — the guard removes the crash, not the semantics.
