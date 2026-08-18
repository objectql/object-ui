/**
 * objectui#5198 — sign-out drops the client-side caches of the session it ends.
 *
 * ## The defect
 *
 * `sessionStorage` is per-TAB, not per-session, and no sign-out call site in
 * the console reloads the page (`AppSidebar`, `AppHeader`, `UserMenu` and
 * `RemediationOverlay` all just call `signOut()` and let the SPA keep running).
 * So everything `MetadataProvider` cached under `objectui:metadata:*` — the
 * app list the server PERMISSION-FILTERED for that session — plus the active
 * organization id in `localStorage` survived into whatever happened next in
 * that tab. On a shared or kiosk browser, a handover, or a support session,
 * "whatever happened next" is a DIFFERENT person signing in, and they were
 * seeded from the previous user's list. Cross-principal, not merely stale.
 *
 * ## What is pinned here, and what is pinned elsewhere
 *
 * This file is the unit half: `signOut()` empties both stores, on the failure
 * path too, and in an order that stays correct. The end-to-end pin — user A
 * signs in, the list is cached by the real provider, A signs out, user B signs
 * in in the same tab and must not read A's list — lives in app-shell
 * (`MetadataProvider.crossPrincipalSeed.test.tsx`) because it needs the real
 * cache writer. That is also what keeps the storage prefix spelled here
 * honest: `@object-ui/app-shell` depends on `@object-ui/auth`, so the constant
 * cannot be imported in this direction and the two ends are held together by
 * behaviour instead.
 */

import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import { TokenStorage } from '../createAuthClient';
import { ActiveOrganizationStorage } from '../createAuthenticatedFetch';
import type { AuthClient } from '../types';
import type { AuthContextValue } from '../AuthContext';

const ORG = { id: 'org_a', name: 'Acme', slug: 'acme' };

/**
 * Implements the handful of methods the provider reaches on these paths — the
 * same shape (and the same one-place cast) as `AuthProvider.test.tsx` and
 * every other double in this package.
 *
 * `signOut` clears `TokenStorage` because the REAL client does, in
 * `createAuthClient.ts`: `betterAuth.signOut()`, then `TokenStorage.clear()`,
 * then the rethrow — which is why the clear happens even on the error path.
 */
function createMockClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    signIn: vi.fn().mockResolvedValue({
      user: { id: 'u_alice', name: 'Alice', email: 'alice@test.com' },
      session: { token: 'tok-alice' },
    }),
    signOut: vi.fn().mockImplementation(async () => {
      TokenStorage.clear();
    }),
    getSession: vi.fn().mockResolvedValue({
      user: { id: 'u_alice', name: 'Alice', email: 'alice@test.com' },
      session: { token: 'tok-alice' },
    }),
    listOrganizations: vi.fn().mockResolvedValue([ORG]),
    getActiveOrganization: vi.fn().mockResolvedValue(ORG),
    setActiveOrganization: vi.fn().mockResolvedValue(ORG),
    getActiveMember: vi.fn().mockResolvedValue({
      id: 'mem_1', organizationId: ORG.id, userId: 'u_alice', role: 'owner',
    }),
    ...overrides,
  } as unknown as AuthClient;
}

/**
 * Holder + effect rather than a bare outer assignment during render — the
 * pattern the other console tests use and what the react-compiler lint rule
 * requires.
 */
const authRef: { current: AuthContextValue | null } = { current: null };

function Probe() {
  const auth = useAuth();
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  return (
    <div>
      <span data-testid="user">{auth.user?.name ?? 'none'}</span>
      <span data-testid="orgs">{auth.organizations.map((o) => o.name).join(',')}</span>
      <span data-testid="active-org">{auth.activeOrganization?.name ?? 'none'}</span>
    </div>
  );
}

/** Render a signed-in console and wait until the org block has resolved. */
async function renderSignedIn(client: AuthClient) {
  const view = render(
    <AuthProvider authUrl="/api/auth" client={client}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(view.getByTestId('user').textContent).toBe('Alice'));
  await waitFor(() => expect(view.getByTestId('active-org').textContent).toBe('Acme'));
  return view;
}

/** The state the previous session leaves behind in this tab. */
function seedPreviousSessionCaches() {
  sessionStorage.setItem('objectui:metadata:app:org_a:abc', JSON.stringify([{ name: 'crm' }]));
  sessionStorage.setItem('objectui:metadata:object:org_a:abc', JSON.stringify([{ name: 'account' }]));
  // The pre-#4486 key shape can still be present in a tab open across upgrades.
  sessionStorage.setItem('objectui:metadata:view', JSON.stringify([{ name: 'v' }]));
  ActiveOrganizationStorage.set('org_a');
}

/** Every `objectui:metadata:*` key currently in sessionStorage. */
function metadataKeys(): string[] {
  return Object.keys(sessionStorage).filter((k) => k.startsWith('objectui:metadata:'));
}

beforeEach(() => {
  authRef.current = null;
  sessionStorage.clear();
  localStorage.clear();
  TokenStorage.clear();
  ActiveOrganizationStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('signOut purges the signed-out principal’s client caches (#5198)', () => {
  it('removes every objectui:metadata entry and the active-org id', async () => {
    const client = createMockClient();
    await renderSignedIn(client);
    seedPreviousSessionCaches();
    sessionStorage.setItem('objectui:sidebar:collapsed', 'true');
    localStorage.setItem('objectui:theme', 'dark');

    await act(async () => {
      await authRef.current!.signOut();
    });

    expect(metadataKeys()).toEqual([]);
    expect(ActiveOrganizationStorage.get()).toBeNull();
    // Scoped to the caches of the ended session: unrelated client state — a UI
    // preference, a theme — is nobody's permission-filtered data and stays.
    expect(sessionStorage.getItem('objectui:sidebar:collapsed')).toBe('true');
    expect(localStorage.getItem('objectui:theme')).toBe('dark');
  });

  it('purges even when the sign-out request FAILS', async () => {
    // The real client clears `TokenStorage` before rethrowing, so a failed
    // call still leaves this tab without a session — the caches that session
    // authenticated for must not outlive it.
    const client = createMockClient({
      signOut: vi.fn().mockImplementation(async () => {
        TokenStorage.clear();
        throw new Error('network down');
      }),
    });
    await renderSignedIn(client);
    seedPreviousSessionCaches();

    await act(async () => {
      await authRef.current!.signOut();
    });

    expect(metadataKeys()).toEqual([]);
    expect(ActiveOrganizationStorage.get()).toBeNull();
  });

  it('purges the metadata entries BEFORE clearing the active-org id', async () => {
    // Ordering pin. The purge above matches by prefix and so does not read the
    // org scope — but the keys it targets ARE org-scoped (#4486), so anything
    // scope-derived added later would compute the no-org scope and delete
    // nothing if the org id had already been dropped. Recording what storage
    // looks like at the moment the org is cleared keeps that order enforced
    // rather than merely commented.
    const observed: string[][] = [];
    const realClear = ActiveOrganizationStorage.clear.bind(ActiveOrganizationStorage);
    vi.spyOn(ActiveOrganizationStorage, 'clear').mockImplementation(() => {
      observed.push(metadataKeys());
      realClear();
    });

    const client = createMockClient();
    await renderSignedIn(client);
    seedPreviousSessionCaches();

    await act(async () => {
      await authRef.current!.signOut();
    });

    expect(observed.length).toBeGreaterThan(0);
    expect(observed[observed.length - 1]).toEqual([]);
  });

  it('drops the previous principal’s organization block from context', async () => {
    // The list is the workspaces THAT user belongs to (the switcher renders
    // it), and a surviving `activeOrganization` would also suppress the
    // re-resolution for the next user: `refreshOrganizations` only asks the
    // server for the active org `if (orgs.length > 0 && !activeOrganization)`.
    // Same pairing `deleteOrganization` / `leaveOrganization` already use.
    const client = createMockClient();
    const view = await renderSignedIn(client);
    expect(view.getByTestId('orgs').textContent).toBe('Acme');

    await act(async () => {
      await authRef.current!.signOut();
    });

    expect(view.getByTestId('orgs').textContent).toBe('');
    expect(view.getByTestId('active-org').textContent).toBe('none');
  });
});
