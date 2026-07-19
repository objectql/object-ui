import { describe, it, expect } from 'vitest';
import { resolveManagedByEmptyState } from '../managedByEmptyState';

// Mirror the real i18n fallback: return the English `defaultValue` baked into
// the helper. The en.ts bundle mirrors these strings verbatim, so asserting on
// the defaults is asserting on the copy a user actually sees.
const t = (key: string, opts?: Record<string, unknown>): string =>
  (opts?.defaultValue as string) ?? key;

describe('resolveManagedByEmptyState', () => {
  it('returns undefined for platform / config / unknown buckets', () => {
    expect(resolveManagedByEmptyState('platform', t)).toBeUndefined();
    expect(resolveManagedByEmptyState('config', t)).toBeUndefined();
    expect(resolveManagedByEmptyState(undefined, t)).toBeUndefined();
    expect(resolveManagedByEmptyState('nope', t)).toBeUndefined();
  });

  it('leaves the system / append-only buckets intact', () => {
    expect(resolveManagedByEmptyState('system', t)?.title).toBe('Nothing here yet');
    expect(resolveManagedByEmptyState('append-only', t)?.title).toBe('No events recorded');
  });

  // ADR-0103 — a `system` object that opened creation (writable set: Notification
  // Preferences, delegated RBAC assignments, …) is admin/user-writable data. The
  // "entries appear automatically" copy would be wrong, so the helper returns
  // undefined and the caller falls back to the generic empty state (New button).
  it('returns undefined for a system object whose userActions opened creation', () => {
    expect(resolveManagedByEmptyState('system', t, 'sys_notification_preference', { create: true })).toBeUndefined();
    // A system object that did NOT open creation stays engine-owned.
    expect(resolveManagedByEmptyState('system', t, 'sys_automation_run', {})?.title).toBe('Nothing here yet');
    expect(resolveManagedByEmptyState('system', t, 'sys_automation_run', undefined)?.title).toBe('Nothing here yet');
    // append-only is unaffected by userActions.create (audit logs stay locked).
    expect(resolveManagedByEmptyState('append-only', t, 'sys_audit_log', { create: true })?.title).toBe('No events recorded');
  });

  it('gives sys_user an actionable empty state (org invite + SSO JIT, end-users)', () => {
    const es = resolveManagedByEmptyState('better-auth', t, 'sys_user');
    expect(es?.title).toBe('No users yet');
    expect(es?.message).toMatch(/invite teammates to your organization/i);
    expect(es?.message).toMatch(/just-in-time/i);
    expect(es?.message).toMatch(/end-users/i);
  });

  it('gives sys_team its own empty state that does not contradict the Create Team button', () => {
    // sys_team CAN be created by hand — the `create_team` toolbar action hits
    // better-auth's organization/create-team. The generic "not added by hand
    // here" identity copy would flatly contradict that visible Create Team
    // button (the reported empty-state / CTA mismatch). Regression guard.
    const es = resolveManagedByEmptyState('better-auth', t, 'sys_team');
    expect(es?.title).toBe('No teams yet');
    expect(es?.message).toMatch(/create team/i);
    expect(es?.title).not.toBe('No identity records');
    expect(es?.message).not.toMatch(/not added by hand here/i);
  });

  it('gives every other identity table a generic, accurate empty state', () => {
    // The single better-auth bucket is shared by ~18 identity tables; only
    // sys_user has a real onboarding answer. Sessions / tokens / jwks must NOT
    // get a "go invite someone" CTA.
    for (const name of ['sys_session', 'sys_api_key', 'sys_jwks', undefined]) {
      const es = resolveManagedByEmptyState('better-auth', t, name as string | undefined);
      expect(es?.title).toBe('No identity records');
      expect(es?.message).toMatch(/created by the authentication provider/i);
      expect(es?.message).not.toMatch(/invite/i);
    }
  });

  // cloud#580 regression: the empty state must never advertise affordances that
  // are gated off (env-level "Invite User" is multi-org-only, hidden in
  // single-org) or that do not exist ("Reset Password" is not a toolbar action).
  it('never names the unreachable "Invite User" / "Reset Password" workflows', () => {
    for (const name of ['sys_user', 'sys_session', undefined]) {
      const es = resolveManagedByEmptyState('better-auth', t, name as string | undefined);
      expect(es?.message).not.toMatch(/invite user/i);
      expect(es?.message).not.toMatch(/reset password/i);
    }
  });
});
