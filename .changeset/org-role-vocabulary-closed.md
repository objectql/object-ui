---
'@object-ui/auth': patch
---

docs(auth): the org-role vocabulary is closed — correct the mirror's standing instruction (framework ADR-0108)

`org-roles.ts` carried a standing instruction that is now wrong: *"a role added
server-side must be added HERE too."* There are no server-side additions left
to chase.

The framework used to register every declared `position` / `permission` name as
an organization role, so the console's list could always fall behind the
server's. That channel was retired (framework ADR-0108, objectstack#3723):
every value stored in `sys_member.role` is projected into
`current_user.positions`, so a business role handed out that way was capability
with none of the position system's controls — no `granted_by`, no validity
window, no scope check. `sys_member.role` is now a closed, framework-owned list
of `owner` / `admin` / `delegated_admin` / `member`, and an app's own business
roles are positions, granted through `sys_user_position` or an invitation's
placement (framework ADR-0105 D8).

So this mirror is now complete **by construction** rather than by vigilance.
Nothing about the console's behaviour changes — the four names and their labels
are what they already were.

Still a mirror rather than a derivation, but only for a packaging reason now:
the names live in `@objectstack/spec` as `BUILTIN_MEMBERSHIP_ROLES` /
`BUILTIN_MEMBERSHIP_ROLE_OPTIONS`, which `@object-ui/auth` cannot import yet —
this package takes no dependency on `@objectstack/spec`, and those constants
ship in the first release carrying ADR-0108 (they are absent from the published
16.1.0). A new test pins the list to exactly those four in display order until
then, so drift fails loudly instead of silently offering a value the server's
enforced `select` would reject.
