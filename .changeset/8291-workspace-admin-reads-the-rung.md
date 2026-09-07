---
"@object-ui/auth": patch
---

`useWorkspaceAdminStatus` stops deriving platform-administrator standing from a NAME in the
session's `positions[]`, and reads the ADR-0095 posture rung (`user.isPlatformAdmin`) instead.

Framework objectstack#15948 (declared BREAKING) redefined that array: it used to be the
`sys_user.role` scalar split on commas, and it is now built by `resolveUserAuthzGrants` from
ADR-0057 D4 `sys_user_position` assignments. `sys_user_position` is `apiEnabled` with
unconstrained `position` values, so a caller holding tenant-administration authority can mint a
row spelling `platform_admin` for one of their own users — and the third leg of this hook, which
scanned `positions[]` for any admin-sounding name, answered `true` for them. The server was
already fixed (`platform-admin-gate.ts` dropped its positions leg and four evaluator sites moved
to the rung), so what such a principal got was a Console painting platform-administrator surfaces
while every underlying call was refused: misleading, in the direction that reveals platform
structure to a tenant-controlled account.

The array read is narrowed rather than deleted, name by name. `org_owner` and `org_admin` stay:
`resolveUserAuthzGrants` emits exactly those from the ACTIVE organization's `sys_member.role`, a
minted spelling of them claims authority inside the tenant that the minter already holds, and they
are what lets a stamped tenant administrator resolve on the first frame (objectui#5619) instead of
waiting for the member pipeline. `platform_admin` is dropped and replaced by the rung, which is
byte-for-byte what the server's own `hasPlatformAdminStanding` returns. `owner`, `admin`,
`super_admin`, `superadmin` and `system_admin` are dropped from the array read too — no server
derivation emits any of them into `positions[]` (the membership leg normalizes `owner`/`admin` to
`org_*` first), so a hit could only ever have been a tenant-written row. All five remain valid for
the two scalar legs, where they are the raw membership role and the stored `user.role`.

The docblock that argued AGAINST reading `user.isPlatformAdmin` — on the grounds that the server
computed it as `'platform_admin' in positions`, "two spellings for one fact" — is rewritten rather
than left standing. After #15948 the flag derives from the unscoped `admin_full_access` grant and
the array does not, so they can disagree and the rung is right.

No behaviour changes for a genuine administrator: a platform administrator on a single-tenant
deployment still resolves through the flag (objectui#5389 stays green), a tenant administrator
still resolves through the member row and through `org_owner`/`org_admin`, and the objectui#5619
`isResolved` semantics are unchanged. Pinned by `__tests__/workspaceAdminRung-8291.test.tsx`.
