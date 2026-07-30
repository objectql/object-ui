---
'@object-ui/auth': patch
---

refactor(auth): derive the org-role vocabulary from `@objectstack/spec` instead of mirroring it

`org-roles.ts` restated the four membership-role names that `@objectstack/spec`
owns as `BUILTIN_MEMBERSHIP_ROLES`. That was a mirror for packaging reasons
only: this package took no dependency on the spec, and no published spec
carried the constants. Both blockers are gone — `@objectstack/spec@17.0.0-rc.0`
ships ADR-0108's closed vocabulary and the workspace already pins
`^17.0.0-rc.0` — so the four `ORG_ROLE_*` constants are now re-exports,
`OrgRole` is `BuiltinMembershipRole`, and `ORG_ROLES` is
`[...BUILTIN_MEMBERSHIP_ROLES]`. The list cannot drift from what the server's
enforced `select` accepts, by construction.

Deliberately still local: `ORG_ROLE_LABELS` and the grade ladder
(`orgRoleGrade` / `invitableOrgRoles` / `assignableOrgRoles`). They are console
concerns — i18n keys and screen-narrowing rules — and folding them into the
name list would be the modeling error ADR-0108 D4 warns about: *what names
exist* is a list; *which names mean authority* and *how a name projects* are
rules that belong next to what they govern.

The #2907 drift guard (`is EXACTLY the framework four`) is dropped — a derived
list cannot drift, and asserting a re-export against a literal is noise. No
behaviour changes: the four names, their display order, and their labels are
exactly what they already were.
