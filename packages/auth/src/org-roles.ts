/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Organization membership roles — the ONE place the console names them.
 *
 * These are better-auth's organization roles as the ObjectStack framework
 * registers them, stored in `sys_member.role` / `sys_invitation.role`. Before
 * this module the vocabulary was inlined as `type Role = 'owner' | 'admin' |
 * 'member'` in both `MembersPage` and `InviteMemberDialog`, so a role the
 * server had learned about was still unreachable from either screen.
 *
 * ## The vocabulary is CLOSED — this mirror is complete by construction
 *
 * [framework ADR-0108 / objectstack#3723] These four names are the WHOLE list,
 * and the framework owns them. An application cannot add a fifth: the server
 * used to register every declared `position` / `permission` name as an
 * organization role, and that was retired, because every value stored in
 * `sys_member.role` is projected into `current_user.positions` — so a business
 * role handed out this way was capability with none of the position system's
 * controls (no `granted_by`, no validity window, no scope check).
 *
 * So the standing instruction that used to live here — *"a role added
 * server-side must be added HERE too"* — no longer applies. There are no
 * server-side additions to chase. A membership role is an organization GRADE
 * (what you may reach); what a person may DO is a position, granted through
 * `sys_user_position` or an invitation's placement (framework ADR-0105 D8).
 *
 * ⚠️ Still a mirror, not a derivation — but now only for a packaging reason,
 * not a design one. The names live in `@objectstack/spec` as
 * `BUILTIN_MEMBERSHIP_ROLES` / `BUILTIN_MEMBERSHIP_ROLE_OPTIONS`, which
 * `@object-ui/auth` cannot import yet: this package does not depend on
 * `@objectstack/spec`, and the constants ship in the first release carrying
 * ADR-0108 (absent from the published 16.1.0). Once this package takes that
 * dependency at a version that has them, the four `export const`s below become
 * a re-export and `ORG_ROLES` becomes `[...BUILTIN_MEMBERSHIP_ROLES]` — the
 * labels and grade ladder stay here, since they are console concerns.
 * `orgRolesMatchFramework` in the tests pins the list until then.
 */

export const ORG_ROLE_OWNER = 'owner';
export const ORG_ROLE_ADMIN = 'admin';
/**
 * [framework ADR-0105 D8] The delegated issuer grade. May reach
 * `/organization/invite-member` WITHOUT being an org admin, which is what gives
 * D8's scope-bounded issuance gate a caller. Carries no authority of its own:
 * what a delegate may actually *place* comes from a separately-granted
 * `adminScope`, surfaced to this console by `describeDelegableScope()`.
 */
export const ORG_ROLE_DELEGATED_ADMIN = 'delegated_admin';
export const ORG_ROLE_MEMBER = 'member';

export type OrgRole =
  | typeof ORG_ROLE_OWNER
  | typeof ORG_ROLE_ADMIN
  | typeof ORG_ROLE_DELEGATED_ADMIN
  | typeof ORG_ROLE_MEMBER;

/** Display order: most privileged first, as the screens list them. */
export const ORG_ROLES: readonly OrgRole[] = [
  ORG_ROLE_OWNER,
  ORG_ROLE_ADMIN,
  ORG_ROLE_DELEGATED_ADMIN,
  ORG_ROLE_MEMBER,
] as const;

/** i18n key + English fallback for a role, so every screen labels it identically. */
export const ORG_ROLE_LABELS: Record<OrgRole, { key: string; defaultValue: string }> = {
  [ORG_ROLE_OWNER]: { key: 'organization.roles.owner', defaultValue: 'Owner' },
  [ORG_ROLE_ADMIN]: { key: 'organization.roles.admin', defaultValue: 'Admin' },
  [ORG_ROLE_DELEGATED_ADMIN]: {
    key: 'organization.roles.delegatedAdmin',
    defaultValue: 'Delegated Admin',
  },
  [ORG_ROLE_MEMBER]: { key: 'organization.roles.member', defaultValue: 'Member' },
};

const GRADE_UNRESOLVED = 0;
const GRADE_MEMBER = 1;
const GRADE_ADMIN = 2;
const GRADE_OWNER = 3;

/**
 * Grade ladder, mirroring the framework's invitation role cap. Anything
 * unrecognized — `member`, `delegated_admin`, an app-registered role — grades
 * as an ordinary member; only better-auth's two administrative roles outrank
 * it, because only they are auto-elevated to `organization_admin` server-side.
 *
 * An absent/unreadable role grades BELOW a plain member: the fail-closed floor,
 * so an unverified caller is offered nothing privileged.
 */
export function orgRoleGrade(raw: unknown): number {
  if (typeof raw !== 'string') return GRADE_UNRESOLVED;
  const roles = raw
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (roles.length === 0) return GRADE_UNRESOLVED;
  let grade = GRADE_MEMBER;
  for (const role of roles) {
    if (role === ORG_ROLE_OWNER) grade = Math.max(grade, GRADE_OWNER);
    else if (role === ORG_ROLE_ADMIN) grade = Math.max(grade, GRADE_ADMIN);
  }
  return grade;
}

/**
 * The roles `issuerRole` may confer through an INVITATION — mirroring the
 * framework's `beforeCreateInvitation` role cap:
 *
 *  - an invited role may never outrank the issuer's own;
 *  - an issuer below admin grade may invite as `member` only (an app-registered
 *    role projects into `current_user.positions` and may be bound to permission
 *    sets, so it is a capability channel too — a delegate's channel for
 *    capability is the invitation's *placement*, which the D12 gate allowlists).
 *
 * Same property as the placement picker: this NARROWS, it does not decide. The
 * server re-checks and rejects out-of-cap invitations, so the console is free to
 * be helpful without being load-bearing — and it fails toward *less*: an
 * unresolvable issuer role offers `member` alone.
 */
export function invitableOrgRoles(issuerRole: unknown): OrgRole[] {
  const grade = orgRoleGrade(issuerRole);
  if (grade < GRADE_ADMIN) return [ORG_ROLE_MEMBER];
  return ORG_ROLES.filter((r) => orgRoleGrade(r) <= grade);
}

/**
 * The roles `actorRole` may SET on an existing member — a different gate from
 * invitation, mirroring better-auth's `update-member-role` route rather than the
 * framework's cap:
 *
 *  - the route requires the `member: ["update"]` permission, which only
 *    `owner`/`admin` hold (`delegated_admin` is built from `memberAc`, so it has
 *    `member: []` and may not re-role anyone);
 *  - only an owner may SET `owner`, and only an owner may modify a member who
 *    already IS one (better-auth's `creatorRole` protection).
 *
 * Returns an empty list when the actor may not re-role at all, so the screen can
 * omit the affordance instead of offering items that would 403.
 */
export function assignableOrgRoles(actorRole: unknown, targetRole?: unknown): OrgRole[] {
  const actor = orgRoleGrade(actorRole);
  if (actor < GRADE_ADMIN) return [];
  const actorIsOwner = actor >= GRADE_OWNER;
  // An existing owner is owner-editable only.
  if (!actorIsOwner && orgRoleGrade(targetRole) >= GRADE_OWNER) return [];
  return ORG_ROLES.filter((r) => (r === ORG_ROLE_OWNER ? actorIsOwner : true));
}
