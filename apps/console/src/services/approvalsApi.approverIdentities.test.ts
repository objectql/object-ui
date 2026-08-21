/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#5424 site 3 — "My Pending" kept the person, lost every position.
 *
 * ## What was wrong
 *
 * `buildApproverIdentities()` derived `role:<name>` identities from
 * `user.roles`, which the protocol-17 session face does not emit: framework
 * ADR-0090 D3 renamed it to `positions` with no deprecation window, measured on
 * a live 17.1.0 server in objectui#5389. Unlike site 2 (`sharedUserFeeds`,
 * which read nothing else and so emitted no role identity at all), this builder
 * also splits the scalar `user.role` — so it did not die, it DEGRADED, and that
 * is worse to notice: on the measured payload it yielded `role:user`, an
 * identity that looks like it works, while every business position name
 * (`manager`, `finance_approver`, …) — the names an approval is actually
 * addressed to — was silently dropped.
 *
 * The old declaration described the two shapes as "multi-role shape (some auth
 * providers)" versus better-auth's scalar. That is no longer the distinction
 * that matters: BOTH are emitted, by the same server, in the same payload, and
 * they carry different things.
 *
 * ## Why these pins are shaped this way
 *
 * A pin that merely asserts "positions are read" would be green against the
 * broken code too, which also produced identities (`role:user`) and also
 * returned a non-empty list. So the cases below assert on the POSITION-derived
 * identities specifically, separated from the scalar-derived one — that is the
 * population that was empty.
 *
 * ## Reverse verification (direction predicted BEFORE running, measured in this PR)
 *
 * Restore `...(user.roles || [])`:
 *   - "derives an identity from every position" goes RED with the
 *     position-derived list empty — received `['role:user']`, expected it to
 *     contain `role:manager` and `role:finance_approver`;
 *   - "keeps the scalar `role` as a second source" stays GREEN — it never
 *     depended on the retired key, which is what makes the case above evidence
 *     about positions rather than about the builder working at all;
 *   - the de-duplication and negative-control cases stay GREEN both ways.
 */
import { describe, it, expect } from 'vitest';

import { buildApproverIdentities } from './approvalsApi';

/**
 * The measured protocol-17 payload (objectui#5424), with a business position
 * added: the scalar `role` is `'user'`, and the names that matter live only in
 * `positions`.
 */
const PROTOCOL_17_USER = {
  id: 'u_1',
  email: 'admin@example.com',
  role: 'user',
  positions: ['manager', 'finance_approver'],
};

/** Just the role-addressed subset — what `pending_approvers` is matched on. */
const roleIdentities = (user: Parameters<typeof buildApproverIdentities>[0]) =>
  buildApproverIdentities(user).filter((i) => i.startsWith('role:'));

describe('objectui#5424 — `buildApproverIdentities` reads `positions`, the published spelling', () => {
  it('derives an identity from every position, not just the scalar role', () => {
    // The pin. On `origin/main` this is exactly `['role:user']` — the scalar
    // survived and both business positions were gone.
    expect(roleIdentities(PROTOCOL_17_USER)).toEqual([
      'role:user',
      'role:manager',
      'role:finance_approver',
    ]);
  });

  it('keeps the scalar `role` as a second source — protocol 17 still emits it', () => {
    // Control: green before and after. `role` is a separate key that the
    // measured payload carries alongside `positions`; objectui#5424 is about
    // the retired one, so this must not move.
    expect(roleIdentities({ id: 'u_1', role: 'auditor' })).toEqual(['role:auditor']);
  });

  it('still splits a comma-separated scalar role', () => {
    // better-auth's multi-value scalar shape, unchanged.
    expect(roleIdentities({ id: 'u_1', role: 'auditor, approver' })).toEqual([
      'role:auditor',
      'role:approver',
    ]);
  });

  it('does not resurrect the retired `roles` key as a fallback', () => {
    // `packages/auth/src/types.ts` forbids pairing the two spellings in so many
    // words. A session that still carries the old key must not be able to
    // smuggle position names in through it — that is how a retired spelling
    // becomes a second de-facto contract.
    const identities = buildApproverIdentities({
      id: 'u_1',
      roles: ['ghost_position'],
    } as unknown as Parameters<typeof buildApproverIdentities>[0]);

    expect(identities).toEqual(['u_1']);
  });

  it('still sends the person-addressed identities', () => {
    // Control for the first case: id and email never came from the retired key.
    expect(buildApproverIdentities(PROTOCOL_17_USER)).toEqual([
      'u_1',
      'admin@example.com',
      'role:user',
      'role:manager',
      'role:finance_approver',
    ]);
  });

  it('de-duplicates a position that repeats the scalar role', () => {
    // The measured payload's `positions` contains the scalar's value (`user`),
    // so this overlap is the common case, not an edge one.
    expect(roleIdentities({ id: 'u_1', role: 'user', positions: ['user', 'manager'] })).toEqual([
      'role:user',
      'role:manager',
    ]);
  });

  it('negative control: a user with neither `positions` nor `role` yields no role identity', () => {
    // Must not throw, and must not manufacture `role:undefined` — an identity
    // that matches nothing but would be sent on every request.
    const identities = buildApproverIdentities({ id: 'u_1', email: 'a@b.c' });

    expect(identities).toEqual(['u_1', 'a@b.c']);
    expect(identities.some((i) => i.includes('undefined'))).toBe(false);
  });

  it('negative control: no session at all yields no identities', () => {
    expect(buildApproverIdentities(null)).toEqual([]);
    expect(buildApproverIdentities(undefined)).toEqual([]);
  });
});
