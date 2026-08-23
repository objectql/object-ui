/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5719 — does `user.positions` re-resolve across an organization
 * switch, and by WHAT mechanism?
 *
 * ## The card, and what measuring it found
 *
 * #5719 observed that `AuthProvider.switchOrganization` never calls
 * `loadSession()`, while framework `packages/plugins/plugin-auth/src/
 * auth-manager.ts` derives `user.positions[]` inside `customSession` from
 * `session.activeOrganizationId` — so leg 3 of `useWorkspaceAdminStatus`
 * would keep answering for the PREVIOUS organization. Because that hook is
 * `leg1 || leg2 || leg3` AND short-circuits `isResolved` to true the moment
 * any leg says admin, a stale `org_owner` reads as a CONFIRMED admin in the
 * new organization. The card could not close the last step from this repo and
 * was filed as an observation: *if* the server re-issues a bearer token on
 * `POST /organization/set-active`, `TokenStorage.subscribeRotation` already
 * drives `loadSession()` (objectui#4467) and there is no defect at all.
 *
 * It does, and there is not. Measured against better-auth 1.6.28 driven
 * standalone (the version `packages/auth` resolves), with the organization and
 * bearer plugins that framework `auth-manager.ts` always enables:
 *
 *   GET  /get-session          → NO `set-auth-token`; body `session.token` is
 *                                the UNSIGNED value
 *   POST /organization/set-active
 *                              → `set-auth-token` present, and its value is
 *                                the SIGNED `<token>.<signature>` spelling
 *
 * `setActiveOrganization` succeeds through `setSessionCookie(ctx, …)`
 * unconditionally (`plugins/organization/routes/crud-org.mjs`), and
 * `bearer()`'s after-hook emits `set-auth-token` for ANY response that stages
 * a session `Set-Cookie` (`plugins/bearer/index.mjs`). The session row keeps
 * its token — `internalAdapter.updateSession` writes only
 * `activeOrganizationId` — so the switch does not mint a new session.
 *
 * ## The mechanism is a SPELLING difference, not a new session
 *
 * The rotation that saves this is real but accidental, and that is exactly why
 * it is pinned here rather than left to the framework:
 *
 *   - `createAuthClient.getSession()` stores `payload.session.token` — the
 *     UNSIGNED value, which is what `sys_session.token` holds.
 *   - `createBearerFetch` stores whatever arrives in `set-auth-token` — the
 *     SIGNED value.
 *
 * Two spellings of ONE session, and `TokenStorage.set` notifies on a value
 * change. So an org switch flips storage unsigned → signed, that reads as a
 * rotation, `AuthProvider`'s objectui#4467 subscription calls `loadSession()`,
 * and `customSession` recomputes `positions` for the NEW organization. The
 * follow-up `get-session` re-stores the unsigned form, which re-arms the
 * mechanism for the next switch.
 *
 * Nothing declares that contract. Normalise either lane onto one spelling —
 * an entirely reasonable-looking tidy-up — and identity silently stops
 * re-resolving across an org switch, with the over-permissive consequence
 * #5719 described and no test anywhere to catch it. These cases are that test.
 *
 * ## Why no explicit `refreshSession()` was added
 *
 * It would double-fetch. The rotation path ALREADY spends exactly one
 * `get-session` per switch, so an explicit call makes every org switch cost
 * two on the common path — a regression traded for an edge case. The card's
 * own caveat (that `refreshSession` deliberately does not raise `isLoading`,
 * so the console must not blank) is honoured for free by not adding one.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import { useWorkspaceAdminStatus } from '../useWorkspaceAdminStatus';
import { TokenStorage } from '../createAuthClient';
import { ActiveOrganizationStorage, SessionUserScope } from '../ActiveOrganizationStorage';
import type { AuthClient, AuthOrganization, AuthOrganizationMember, AuthUser } from '../types';

/** The UNSIGNED session token — `sys_session.token`, and `session.token` on the wire. */
const RAW_TOKEN = 'sess_5719_raw';
/** The SIGNED spelling `bearer()` hands back in `set-auth-token`. Measured shape. */
const SIGNED_TOKEN = `${RAW_TOKEN}.bvWj0cFhrtUI77i7tjyNuEyta2grAAAWGaeYeB7eY`;

const ORG_A: AuthOrganization = { id: 'org_a', name: 'Alpha', slug: 'alpha' } as AuthOrganization;
const ORG_B: AuthOrganization = { id: 'org_b', name: 'Beta', slug: 'beta' } as AuthOrganization;

/** ADR-0068 D2 — a membership role maps onto a canonical position name. */
function mapMembershipRole(role: string): string {
  return role === 'owner' ? 'org_owner' : role === 'admin' ? 'org_admin' : 'org_member';
}

interface ServerOptions {
  /** `role` in each organization's member row for this user. */
  memberships: Record<string, string>;
  /**
   * What the `set-active` response hands back in `set-auth-token`. Production
   * is `signed`; `same` is the counterfactual the last case below explores.
   */
  rotationSpelling?: 'signed' | 'same';
}

/**
 * A server double that resolves identity the way the real one does: the
 * session row carries `activeOrganizationId`, and `positions[]` is DERIVED
 * from it on every session read (framework `customSession`). Nothing here
 * caches positions, so a stale answer can only come from the client failing to
 * ask again — which is the whole question #5719 raised.
 */
function orgBoundClient(options: ServerOptions) {
  const { memberships, rotationSpelling = 'signed' } = options;
  // The session ROW. `set-active` mutates only this field, exactly as
  // `internalAdapter.updateSession` does.
  const sessionRow = { token: RAW_TOKEN, activeOrganizationId: ORG_A.id as string | null };

  const getSession = vi.fn(async () => {
    const orgId = sessionRow.activeOrganizationId;
    const role = orgId ? memberships[orgId] : undefined;
    const user = {
      id: 'u_5719',
      name: 'Switcher',
      email: 'switcher@example.com',
      // Leg 2 must stay genuinely negative, or the switch is unobservable.
      role: 'user',
      positions: ['user', ...(role ? [mapMembershipRole(role)] : [])],
      isPlatformAdmin: false,
    } as unknown as AuthUser;
    // What `createAuthClient.getSession` really does: store the UNSIGNED
    // `payload.session.token`. This is the half that re-arms the mechanism.
    TokenStorage.set(sessionRow.token);
    return { user, session: { token: sessionRow.token, activeOrganizationId: orgId } };
  });

  const setActiveOrganization = vi.fn(async (orgId: string) => {
    sessionRow.activeOrganizationId = orgId;
    // What `createBearerFetch` really does: adopt `set-auth-token` off the
    // response, BEFORE the call resolves.
    TokenStorage.set(rotationSpelling === 'signed' ? SIGNED_TOKEN : sessionRow.token);
    return orgId === ORG_A.id ? ORG_A : ORG_B;
  });

  const getActiveMember = vi.fn(async () => {
    const orgId = sessionRow.activeOrganizationId;
    const role = orgId ? memberships[orgId] : undefined;
    if (!orgId || !role) return null;
    return { id: `m_${orgId}`, organizationId: orgId, userId: 'u_5719', role } as AuthOrganizationMember;
  });

  const client = {
    getSession,
    listOrganizations: vi.fn(async () => [ORG_A, ORG_B]),
    getActiveOrganization: vi.fn(async () =>
      sessionRow.activeOrganizationId === ORG_A.id ? ORG_A : ORG_B,
    ),
    getActiveMember,
    setActiveOrganization,
  } as unknown as AuthClient;

  return { client, getSession, setActiveOrganization, getActiveMember, sessionRow };
}

let switchOrg: ((orgId: string) => Promise<void>) | null = null;

function Probe() {
  const { user, activeOrganization, switchOrganization } = useAuth();
  const { isAdmin, isResolved } = useWorkspaceAdminStatus();
  switchOrg = switchOrganization;
  return (
    <div>
      <span data-testid="org">{activeOrganization?.id ?? 'none'}</span>
      <span data-testid="positions">{(user?.positions ?? []).join(',') || 'none'}</span>
      <span data-testid="verdict">{isAdmin ? 'admin' : 'not-admin'}</span>
      <span data-testid="resolved">{isResolved ? 'resolved' : 'unresolved'}</span>
    </div>
  );
}

/** Mount, and wait until the org pipeline has settled on organization A. */
async function bootOnOrgA(client: AuthClient) {
  render(
    <AuthProvider authUrl="/api/v1/auth" client={client}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('org').textContent).toBe(ORG_A.id));
  await waitFor(() => expect(screen.getByTestId('resolved').textContent).toBe('resolved'));
}

/** Drive the real `switchOrganization` and let the rotation's fetch settle. */
async function switchToOrgB() {
  await act(async () => {
    await switchOrg!(ORG_B.id);
    // The rotation listener fires `void loadSession()` — deliberately not
    // awaited by `switchOrganization`. Flush its microtasks.
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  switchOrg = null;
  localStorage.clear();
  sessionStorage.clear();
  TokenStorage.clear();
  ActiveOrganizationStorage.clear();
  SessionUserScope._resetForTests();
  // The console reaches an org switch holding the UNSIGNED token, because the
  // mount `loadSession()` stored `session.token` last. Start there.
  TokenStorage.set(RAW_TOKEN);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  TokenStorage.clear();
  SessionUserScope._resetForTests();
});

describe('#5719 — identity re-resolves across an organization switch', () => {
  it('an owner of A who is an ordinary member of B stops reading as admin after the switch', async () => {
    const { client, getSession } = orgBoundClient({
      memberships: { [ORG_A.id]: 'owner', [ORG_B.id]: 'member' },
    });

    await bootOnOrgA(client);
    // The premise: in organization A this viewer IS an admin, through leg 3.
    expect(screen.getByTestId('positions').textContent).toBe('user,org_owner');
    expect(screen.getByTestId('verdict').textContent).toBe('admin');
    const sessionReadsBeforeSwitch = getSession.mock.calls.length;

    await switchToOrgB();

    // The re-resolution actually happened — by whatever mechanism provides it.
    await waitFor(() => expect(getSession.mock.calls.length).toBeGreaterThan(sessionReadsBeforeSwitch));
    // …and it carried the NEW organization's answer into leg 3.
    await waitFor(() => expect(screen.getByTestId('positions').textContent).toBe('user,org_member'));
    await waitFor(() => expect(screen.getByTestId('verdict').textContent).toBe('not-admin'));
    expect(screen.getByTestId('resolved').textContent).toBe('resolved');
  });

  it('an owner of BOTH organizations still reads as admin after the switch (the control)', async () => {
    // Without this case the one above would pass on any change that simply
    // stopped reporting admin — including deleting leg 3 outright.
    const { client } = orgBoundClient({
      memberships: { [ORG_A.id]: 'owner', [ORG_B.id]: 'owner' },
    });

    await bootOnOrgA(client);
    expect(screen.getByTestId('verdict').textContent).toBe('admin');

    await switchToOrgB();

    await waitFor(() => expect(screen.getByTestId('org').textContent).toBe(ORG_B.id));
    expect(screen.getByTestId('positions').textContent).toBe('user,org_owner');
    expect(screen.getByTestId('verdict').textContent).toBe('admin');
    expect(screen.getByTestId('resolved').textContent).toBe('resolved');
  });

  it('spends exactly ONE extra session read per switch (an explicit refresh would double it)', async () => {
    const { client, getSession } = orgBoundClient({
      memberships: { [ORG_A.id]: 'owner', [ORG_B.id]: 'member' },
    });

    await bootOnOrgA(client);
    const before = getSession.mock.calls.length;

    await switchToOrgB();
    await waitFor(() => expect(screen.getByTestId('verdict').textContent).toBe('not-admin'));
    // Let any second, later fetch land before counting.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(getSession.mock.calls.length).toBe(before + 1);
  });

  /**
   * The counterfactual, and the reason this file exists.
   *
   * Everything above is identical except the spelling the `set-active`
   * response hands back: the token the console ALREADY holds instead of the
   * signed form. `TokenStorage.set` does not notify on an unchanged value
   * (objectui#4467, by design — `get-session` re-stores on every boot), so no
   * rotation fires, `loadSession()` is never called, and leg 3 keeps answering
   * for organization A. That is precisely the defect #5719 predicted.
   *
   * It is unreachable in production ONLY because `bearer()` emits the signed
   * `<token>.<signature>` while `createAuthClient.getSession` stores the
   * unsigned `session.token`. This case is what turns that undeclared
   * asymmetry into something a change has to walk past deliberately.
   *
   * If a future change makes `switchOrganization` re-resolve identity
   * EXPLICITLY, this case will fail — and that failure is the signal to update
   * this file, not a defect. The three cases above stay correct either way.
   */
  it('does NOT re-resolve when the switch response echoes the token already held (the counterfactual)', async () => {
    const { client, getSession } = orgBoundClient({
      memberships: { [ORG_A.id]: 'owner', [ORG_B.id]: 'member' },
      rotationSpelling: 'same',
    });

    await bootOnOrgA(client);
    const before = getSession.mock.calls.length;

    await switchToOrgB();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    // No re-resolution: leg 3 is still organization A's answer…
    expect(getSession.mock.calls.length).toBe(before);
    expect(screen.getByTestId('positions').textContent).toBe('user,org_owner');
    // …and the composite verdict is over-permissive in organization B, with
    // `isResolved` short-circuited to true, so callers act on it.
    expect(screen.getByTestId('org').textContent).toBe(ORG_B.id);
    expect(screen.getByTestId('verdict').textContent).toBe('admin');
    expect(screen.getByTestId('resolved').textContent).toBe('resolved');
  });
});

/**
 * The undeclared asymmetry itself, driven through the REAL client rather than
 * a double — because a double could only restate whichever spelling the author
 * already believed.
 *
 * `createAuthClient.getSession()` runs its request through `createBearerFetch`,
 * which adopts `set-auth-token` (SIGNED) the moment the response lands, and
 * THEN stores `payload.session.token` (UNSIGNED) from the body. Last write
 * wins, so a session read always leaves storage holding the unsigned spelling
 * no matter what the response header said. That is what makes the NEXT
 * `set-active` observable as a rotation.
 *
 * Measured against better-auth 1.6.28: `GET /get-session` carries no
 * `set-auth-token` at all in the common case, so the header is included here
 * deliberately — it is the harder direction, and the one a session-refresh
 * response really does take.
 */
describe('#5719 — the two lanes store two spellings of one session', () => {
  beforeEach(() => {
    TokenStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TokenStorage.clear();
  });

  it('getSession() leaves the UNSIGNED session.token stored, even when the response rotates', async () => {
    const { createAuthClient } = await import('../createAuthClient');
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          user: { id: 'u_5719', email: 'switcher@example.com', name: 'Switcher' },
          session: { token: RAW_TOKEN },
        }),
        { status: 200, headers: { 'content-type': 'application/json', 'set-auth-token': SIGNED_TOKEN } },
      ),
    ) as unknown as typeof fetch;

    const client = createAuthClient({ baseURL: 'http://localhost/api/v1/auth', fetchFn });
    const result = await client.getSession();

    expect(result?.session?.token).toBe(RAW_TOKEN);
    // The signed form arrived and was adopted first; the body's unsigned form
    // overwrote it. This ordering is the whole mechanism.
    expect(TokenStorage.get()).toBe(RAW_TOKEN);
    expect(TokenStorage.get()).not.toBe(SIGNED_TOKEN);
  });

  it('the two spellings are different strings, so one replacing the other IS a rotation', () => {
    // Stated here rather than assumed: `bearer()` appends `.<signature>` to the
    // value `sys_session.token` holds, so the signed form can never equal it.
    expect(SIGNED_TOKEN).not.toBe(RAW_TOKEN);
    expect(SIGNED_TOKEN.startsWith(`${RAW_TOKEN}.`)).toBe(true);

    TokenStorage.set(RAW_TOKEN);
    const seen = vi.fn();
    const unsubscribe = TokenStorage.subscribeRotation(seen);
    try {
      TokenStorage.set(SIGNED_TOKEN);
      expect(seen).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});
