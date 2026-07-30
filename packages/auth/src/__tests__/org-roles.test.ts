// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Organization role vocabulary + narrowing helpers.
 *
 * These MIRROR two different server gates, and the tests are written to fail
 * loudly if either drifts:
 *
 *  - `invitableOrgRoles` ↔ the framework's `beforeCreateInvitation` role cap
 *    (framework#3697): never above your own grade, and a below-admin issuer may
 *    invite as `member` only.
 *  - `assignableOrgRoles` ↔ better-auth's `update-member-role` route: needs
 *    `member:["update"]` (owner/admin only), and only an owner may set `owner`
 *    or re-role an existing owner.
 *
 * Both NARROW; neither decides. The server re-checks, so the only failure the
 * console can cause is offering something that then 403s — which is exactly
 * what these pin.
 */

import { describe, it, expect } from 'vitest';
import {
  ORG_ROLES,
  ORG_ROLE_LABELS,
  ORG_ROLE_DELEGATED_ADMIN,
  orgRoleGrade,
  invitableOrgRoles,
  assignableOrgRoles,
} from '../org-roles';

describe('vocabulary', () => {
  it('offers the spec vocabulary WHOLE — including the delegated issuer grade', () => {
    // The names themselves derive from `@objectstack/spec`
    // (`BUILTIN_MEMBERSHIP_ROLES`), so there is no drift to guard against any
    // more — #2907's exact-list assertion is gone with the mirror. What this
    // pins is a console decision: `ORG_ROLES` is the spec list UNFILTERED.
    // Hiding a grade from the screens belongs in the narrowing helpers below,
    // never in the vocabulary.
    expect(ORG_ROLES).toContain(ORG_ROLE_DELEGATED_ADMIN);
  });

  it('every role has a label — a role with no label renders as a raw key', () => {
    for (const role of ORG_ROLES) {
      expect(ORG_ROLE_LABELS[role]?.key).toBeTruthy();
      expect(ORG_ROLE_LABELS[role]?.defaultValue).toBeTruthy();
    }
  });
});

describe('orgRoleGrade', () => {
  it('ranks owner above admin above everything else', () => {
    expect(orgRoleGrade('owner')).toBeGreaterThan(orgRoleGrade('admin'));
    expect(orgRoleGrade('admin')).toBeGreaterThan(orgRoleGrade('member'));
  });

  it('the delegate grade and app roles are ordinary members', () => {
    expect(orgRoleGrade(ORG_ROLE_DELEGATED_ADMIN)).toBe(orgRoleGrade('member'));
    expect(orgRoleGrade('sales_manager')).toBe(orgRoleGrade('member'));
  });

  it('a comma list takes the HIGHEST grade', () => {
    expect(orgRoleGrade('member,admin')).toBe(orgRoleGrade('admin'));
  });

  it('an unresolvable role grades BELOW a plain member (fail-closed floor)', () => {
    for (const v of [null, undefined, '', 42, {}]) {
      expect(orgRoleGrade(v)).toBeLessThan(orgRoleGrade('member'));
    }
  });
});

describe('invitableOrgRoles — mirrors the invitation role cap', () => {
  it('an owner may invite every grade', () => {
    expect(invitableOrgRoles('owner')).toEqual([...ORG_ROLES]);
  });

  it('an admin may invite everything except owner', () => {
    const roles = invitableOrgRoles('admin');
    expect(roles).toContain('admin');
    expect(roles).toContain(ORG_ROLE_DELEGATED_ADMIN);
    expect(roles).toContain('member');
    expect(roles).not.toContain('owner');
  });

  it('a DELEGATE may invite as member only — the escalation chain, closed in the UI too', () => {
    expect(invitableOrgRoles(ORG_ROLE_DELEGATED_ADMIN)).toEqual(['member']);
  });

  it('an unresolvable caller is offered member alone, never nothing', () => {
    // Offering nothing would break the ordinary invite for a caller whose
    // membership simply has not loaded yet; the server still allows `member`.
    for (const v of [null, undefined, '']) {
      expect(invitableOrgRoles(v)).toEqual(['member']);
    }
  });
});

describe('assignableOrgRoles — mirrors update-member-role', () => {
  it('an owner may set anything, including owner', () => {
    expect(assignableOrgRoles('owner', 'member')).toEqual([...ORG_ROLES]);
  });

  it('an admin may set the delegate grade but never owner', () => {
    const roles = assignableOrgRoles('admin', 'member');
    expect(roles).toContain(ORG_ROLE_DELEGATED_ADMIN);
    expect(roles).not.toContain('owner');
  });

  it('an admin may not re-role an existing owner at all', () => {
    expect(assignableOrgRoles('admin', 'owner')).toEqual([]);
  });

  it('a delegate may re-role NOBODY — they hold no member:update permission', () => {
    expect(assignableOrgRoles(ORG_ROLE_DELEGATED_ADMIN, 'member')).toEqual([]);
    expect(assignableOrgRoles('member', 'member')).toEqual([]);
  });

  it('an unresolvable actor may re-role nobody (fail closed)', () => {
    for (const v of [null, undefined, '']) {
      expect(assignableOrgRoles(v, 'member')).toEqual([]);
    }
  });
});
