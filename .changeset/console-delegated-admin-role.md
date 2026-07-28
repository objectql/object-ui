---
"@object-ui/auth": minor
"@object-ui/app-shell": minor
---

feat(console): make the `delegated_admin` org role reachable, and narrow both role pickers to what the server will accept (framework#3697)

The framework registered a fourth organization role — `delegated_admin`, the
grade that may reach `/organization/invite-member` **without** being an org
admin, which is what finally gives ADR-0105 D8's scope-bounded issuance gate a
caller. objectui#2868 already shipped the placement half of that UX (units and
positions narrowed by `describeDelegableScope()`), but the console could not
select the role in the first place: `MembersPage` and `InviteMemberDialog` each
inlined `type Role = 'owner' | 'admin' | 'member'`, so the capability the
framework grew was unreachable from either screen.

**One vocabulary, not two.** The role names, labels and narrowing rules now live
in `@object-ui/auth`'s new `org-roles` module (`ORG_ROLES`, `ORG_ROLE_LABELS`,
`orgRoleGrade`, `invitableOrgRoles`, `assignableOrgRoles`) and both screens
consume it. Note this list still **mirrors** the server rather than deriving
from it — `/auth/config` publishes feature flags but no role vocabulary, so
there is no surface to read; objectstack-ai/objectstack#3723 tracks making one
list the source for all of them. Until then a server-side role addition means
one console edit instead of two.

**The pickers now narrow, the way the placement picker already does.** Both
mirror a *different* server gate, and offering an option the server would refuse
is the failure they prevent:

- **Invite role** ← the framework's `beforeCreateInvitation` role cap: never
  above the issuer's own grade, and an issuer below admin grade may invite as
  `member` only. A `delegated_admin` who picked "Admin" would have been refused
  with a 403; that option is simply no longer offered.
- **Change role** ← better-auth's `update-member-role` route: it requires the
  `member:["update"]` permission (owner/admin only — `delegated_admin` is built
  from `memberAc` and holds `member: []`), and only an owner may set `owner` or
  re-role an existing owner. An actor who may re-role nobody now gets no items
  instead of three that would 403.

Narrowing is convenience, not the boundary — the server re-checks every one of
these — and it fails toward *less*: an unresolved membership offers `member`
alone on invite, and nothing on re-role.

An ordinary invitation is unchanged: with the default role and no placement, the
request body is byte-identical to before.

Note for translators: `organization.roles.*` has never been defined in any
locale bundle — all four labels (owner/admin/member included) resolve through
their `defaultValue` English fallback. The new role follows the same pattern
rather than being the only localized one.
