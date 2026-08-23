/**
 * objectui#5746 — ENUMERATION (measurement, not a fix).
 *
 * Does `MetadataProvider`'s seed key ever get WRITTEN with the `@anon`
 * principal scope in practice, and can a different principal READ it?
 *
 * The whole console mount path is real: the real `AuthProvider` (so the
 * `getSession()` -> `TokenStorage.set` -> `setIsLoading(false)` ordering is the
 * shipped one), the real `ConnectedShell` session gate, the real
 * `MetadataProvider`. Only two boundaries are doubled, and they are the two a
 * test cannot have: the auth server (an `AuthClient` double) and the metadata
 * server (the adapter). Nothing writes `objectui:metadata:*` by hand, so this
 * file cannot agree with a key format the provider does not actually produce.
 */

import fs from 'node:fs';
import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ActiveOrganizationStorage,
  AuthProvider,
  TokenStorage,
  type AuthClient,
} from '@object-ui/auth';
// Not on the `@object-ui/auth` barrel; the vitest alias maps that barrel to
// `packages/auth/src`, so this deep path is the SAME module instance.
import { SessionUserScope } from '../../../../auth/src/ActiveOrganizationStorage';

const PREFIX = 'objectui:metadata:';
const ORG = { id: 'org_a', name: 'Acme', slug: 'acme' };

// ---------------------------------------------------------------------------
// The instrument
// ---------------------------------------------------------------------------

interface Op {
  seq: number;
  op: 'set' | 'get' | 'remove';
  key: string;
  /** The principal segment of the key — the last `:`-delimited field. */
  principal: string;
  /** `TokenStorage.get()` AT THE INSTANT of the operation. */
  bearerAtOp: string | null;
  /** For `set`: how many items were written. For `get`: what it answered. */
  detail: string;
  /** Had `getSession()` already answered when this operation happened? */
  afterSessionResolved: boolean;
}

/** Flipped by the auth client double the moment `getSession()` answers. */
const sessionResolved = { value: false };

const ledger: Op[] = [];
let seq = 0;

function principalOf(key: string): string {
  const parts = key.split(':');
  return parts[parts.length - 1];
}

function record(op: Op['op'], key: string, detail: string) {
  seq += 1;
  ledger.push({
    seq, op, key, principal: principalOf(key), bearerAtOp: TokenStorage.get(), detail,
    afterSessionResolved: sessionResolved.value,
  });
}

let restoreInstrument: (() => void) | null = null;

function installInstrument() {
  const origSet = Storage.prototype.setItem;
  const origGet = Storage.prototype.getItem;
  const origRemove = Storage.prototype.removeItem;
  // NOTE: jsdom hands out `sessionStorage` as a PROXY around the Storage
  // instance, so inside a prototype method `this` is the unproxied target and
  // `this === sessionStorage` is NEVER true. The first run of this file
  // recorded zero operations for exactly that reason — which is what the S0
  // counter-probe exists to catch. The store is therefore identified by the
  // key prefix instead, and `localStorage` is asserted to hold no
  // `objectui:metadata:*` key at all (see `expectPrefixIsSessionOnly`).
  Storage.prototype.setItem = function (key: string, value: string) {
    const r = origSet.call(this, key, value);
    if (key.startsWith(PREFIX)) {
      let n = -1;
      try { const p = JSON.parse(value); if (Array.isArray(p)) n = p.length; } catch { /* not json */ }
      record('set', key, `items=${n}`);
    }
    return r;
  };
  Storage.prototype.getItem = function (key: string) {
    const r = origGet.call(this, key);
    if (key.startsWith(PREFIX)) {
      record('get', key, r === null ? 'MISS' : `HIT len=${r.length}`);
    }
    return r;
  };
  Storage.prototype.removeItem = function (key: string) {
    if (key.startsWith(PREFIX)) {
      const had = origGet.call(this, key) !== null;
      record('remove', key, had ? 'removed-existing' : 'removed-absent');
    }
    return origRemove.call(this, key);
  };
  restoreInstrument = () => {
    Storage.prototype.setItem = origSet;
    Storage.prototype.getItem = origGet;
    Storage.prototype.removeItem = origRemove;
  };
}

/** Nothing writes this prefix to `localStorage` — asserted, not assumed. */
function expectPrefixIsSessionOnly() {
  expect(Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))).toEqual([]);
}

function writes() { return ledger.filter((o) => o.op === 'set'); }
function reads() { return ledger.filter((o) => o.op === 'get'); }
function anonWrites() { return writes().filter((o) => o.principal === '@anon'); }
/**
 * Vitest suppresses `console.log` for PASSING tests, and every scenario here
 * passes by design (they are measurements, not assertions about a defect), so
 * the enumeration is written to a file instead of stdout.
 */
const OUT = process.env.ENUM_OUT ?? '/tmp/anon-seed-5746-enumeration.txt';
function say(line: string) {
  fs.appendFileSync(OUT, line + '\n');
}
function dumpLedger(label: string) {
  say(
    `\n===== LEDGER: ${label} =====\n` +
      (ledger.length === 0
        ? '(no objectui:metadata:* operations at all)'
        : ledger
            .map((o) => `#${o.seq} ${o.op.padEnd(6)} ${o.key}\n        principal=${o.principal} bearerAtOp=${o.bearerAtOp ?? 'null'} getSessionResolved=${o.afterSessionResolved} ${o.detail}`)
            .join('\n')),
  );
}

// ---------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------

/** Every `meta.getItems(type)` the shell issued, in order. */
const metaCalls: string[] = [];
/** Set per scenario: what the metadata server answers for `app`. */
let serverApps: Array<{ name: string }> = [];
/**
 * Whether the browser holds a valid SESSION COOKIE for this scenario.
 *
 * `createAuthenticatedFetch` never sets `credentials`, so the fetch default
 * (`same-origin`) sends the cookie on the console's own `/api/v1/*` calls —
 * which is why a request can be authenticated with no bearer at all.
 */
let hasCookie = false;

/**
 * When true, `app` answers with a promise that never settles — that IS the seed
 * window: the provider has whatever the cache gave it and nothing else. Reset
 * in `beforeEach`, because S3 used to install this by REASSIGNING
 * `fakeAdapter.getClient`, which `vi.restoreAllMocks()` does not undo — S4 then
 * silently ran against S3's adapter and its first reading was void.
 */
let appFetchNeverLands = false;

const fakeAdapter = {
  clearCache: vi.fn(),
  getObjectSchema: vi.fn(async () => null),
  getClient: () => ({
    meta: {
      getItems: (type: string) => {
        metaCalls.push(type);
        // The server model: authenticated by bearer OR by cookie; 401 otherwise.
        if (!TokenStorage.get() && !hasCookie) return Promise.reject(new Error('401 Unauthorized'));
        if (type !== 'app') return Promise.resolve({ type, items: [] });
        if (appFetchNeverLands) return new Promise<never>(() => {});
        return Promise.resolve({ type, items: serverApps });
      },
      getItem: () => Promise.resolve({ item: null }),
    },
  }),
};

vi.mock('../../providers/AdapterProvider', () => ({
  AdapterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdapter: () => fakeAdapter,
}));

import { ConnectedShell } from '../ConsoleShell';
import { useMetadata } from '../../providers/MetadataProvider';

/**
 * @param token  what `getSession()` reports as `session.token`; `null` models a
 *               cookie-only session whose response carries no bearer.
 * @param delayMs how long `getSession()` takes to answer — the window the card
 *               claims `MetadataProvider` mounts inside.
 */
function clientFor(userId: string, token: string | null, delayMs = 0): AuthClient {
  const account = { id: userId, name: userId, email: `${userId}@test.com` };
  return {
    getSession: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      // The real `createAuthClient.getSession()` writes the token it was given
      // before returning — reproduced here because that ordering is the whole
      // question. `null` models the branch that clears it instead.
      if (token) TokenStorage.set(token);
      else TokenStorage.clear();
      sessionResolved.value = true;
      return { user: account, session: token ? { token } : {} };
    }),
    signIn: vi.fn(),
    signOut: vi.fn().mockImplementation(async () => { TokenStorage.clear(); }),
    listOrganizations: vi.fn().mockResolvedValue([ORG]),
    getActiveOrganization: vi.fn().mockResolvedValue(ORG),
    setActiveOrganization: vi.fn().mockResolvedValue(ORG),
    getActiveMember: vi.fn().mockResolvedValue({
      id: `mem_${userId}`, organizationId: ORG.id, userId, role: 'member',
    }),
  } as unknown as AuthClient;
}

const seen: { apps: string; loading: string } = { apps: '', loading: '' };

function Probe() {
  const { apps, loading } = useMetadata();
  useEffect(() => {
    seen.apps = apps.map((a: { name: string }) => a.name).join(',');
    seen.loading = String(loading);
  });
  return (
    <div>
      <span data-testid="apps">{apps.map((a: { name: string }) => a.name).join(',')}</span>
      <span data-testid="loading">{String(loading)}</span>
    </div>
  );
}

function boot(client: AuthClient, opts?: { enabled?: boolean; previewMode?: { simulatedRole: string } }) {
  return render(
    <MemoryRouter>
      <AuthProvider
        authUrl="/api/auth"
        client={client}
        enabled={opts?.enabled ?? true}
        previewMode={opts?.previewMode}
      >
        <ConnectedShell>
          <Probe />
        </ConnectedShell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function settle(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }

beforeEach(() => {
  ledger.length = 0;
  seq = 0;
  metaCalls.length = 0;
  serverApps = [];
  hasCookie = false;
  appFetchNeverLands = false;
  sessionResolved.value = false;
  sessionStorage.clear();
  localStorage.clear();
  TokenStorage.clear();
  ActiveOrganizationStorage.clear();
  SessionUserScope._userId = null;
  installInstrument();
});

afterEach(() => {
  restoreInstrument?.();
  restoreInstrument = null;
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// S0 — COUNTER-PROBE. The instrument must see a write it is pointed at.
// ---------------------------------------------------------------------------

describe('S0 counter-probe — the instrument can see a write that is known to happen', () => {
  it('records the AUTHENTICATED path writing a non-@anon seed', async () => {
    serverApps = [{ name: 'setup' }, { name: 'crm' }];
    TokenStorage.set('tok-alice');              // returning browser, bearer present
    ActiveOrganizationStorage.set(ORG.id);

    boot(clientFor('u_alice', 'tok-alice'));
    await waitFor(() => expect(metaCalls).toContain('app'));
    await settle();
    dumpLedger('S0 authenticated boot (counter-probe)');
    expectPrefixIsSessionOnly();

    // The instrument is LIVE: it saw a real seed write.
    expect(writes().length).toBeGreaterThan(0);
    const w = writes()[writes().length - 1];
    expect(w.key.startsWith(PREFIX)).toBe(true);
    expect(w.detail).toBe('items=2');
    // And that write carried a real principal fingerprint, not @anon.
    expect(w.principal).not.toBe('@anon');
    expect(w.principal).toMatch(/^[0-9a-z]{14}$/);
    expect(w.bearerAtOp).toBe('tok-alice');
  });
});

// ---------------------------------------------------------------------------
// S1 — WINDOW (a): stale token purged by auth-preflight, session by cookie.
// ---------------------------------------------------------------------------

describe('S1 window (a) — mount after auth-preflight purged a stale token', () => {
  it('measures whether a @anon seed is written while getSession is in flight', async () => {
    serverApps = [{ name: 'setup' }, { name: 'crm' }];
    hasCookie = true;                    // the cookie session is the live one
    localStorage.setItem('auth-session-token', 'tok-stale');
    ActiveOrganizationStorage.set(ORG.id);

    // The REAL preflight, against a server that rejects the stale bearer.
    const { preflightAuth } = await import('../../../../../apps/console/src/lib/auth-preflight');
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ user: null }),
    }) as unknown as typeof fetch;
    await preflightAuth('/api/v1/auth');
    globalThis.fetch = realFetch;

    // Preflight did its documented job.
    expect(localStorage.getItem('auth-session-token')).toBeNull();
    expect(TokenStorage.get()).toBeNull();

    // getSession takes 60ms — the whole "window" the card names.
    boot(clientFor('u_alice', 'tok-alice-fresh', 60));
    await waitFor(() => expect(metaCalls).toContain('app'), { timeout: 3000 });
    await settle();
    dumpLedger('S1 stale-token-purged boot, cookie session, getSession delayed 60ms');

    say(`S1: total metadata ops=${ledger.length} writes=${writes().length} ` +
      `anon-writes=${anonWrites().length} reads=${reads().length}`);
  });
});

// ---------------------------------------------------------------------------
// S2 — WINDOW (b): cookie-only session whose get-session carries NO token.
// ---------------------------------------------------------------------------

describe('S2 window (b) — cookie-only session, TokenStorage never written', () => {
  it('measures whether the seed is written under @anon for the whole session', async () => {
    serverApps = [{ name: 'setup' }, { name: 'crm' }, { name: 'hr-secret' }];
    hasCookie = true;
    ActiveOrganizationStorage.set(ORG.id);

    boot(clientFor('u_alice', null));      // no token in the session response
    await waitFor(() => expect(metaCalls).toContain('app'));
    await settle();
    dumpLedger('S2 cookie-only boot (session response carries no token)');

    say(`S2: writes=${writes().length} anon-writes=${anonWrites().length} ` +
      `keys=${JSON.stringify(writes().map((w) => w.key))} ` +
      `sessionStorage now=${JSON.stringify(Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX)))}`);
  });
});

// ---------------------------------------------------------------------------
// S3 — the READ half: can a DIFFERENT principal read what S2 wrote?
// ---------------------------------------------------------------------------

describe('S3 read half — a different principal boots in the same tab', () => {
  it('measures whether user B renders user A’s permission-filtered list', async () => {
    // --- A's session, cookie-only, writes whatever it writes.
    serverApps = [{ name: 'setup' }, { name: 'crm' }, { name: 'hr-secret' }];
    hasCookie = true;
    ActiveOrganizationStorage.set(ORG.id);
    const a = boot(clientFor('u_alice', null));
    await waitFor(() => expect(a.getByTestId('apps').textContent).toBe('setup,crm,hr-secret'));
    a.unmount();
    const afterA = Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX));
    say(`S3: after A, storage holds ${JSON.stringify(afterA)}`);

    // --- B boots in the SAME tab. No sign-out (the #5198 "purge never ran"
    // half: expiry, another tab, a tab open across an upgrade). B's own fetch
    // never lands, so anything B renders came from the seed.
    ledger.length = 0;
    serverApps = [];
    appFetchNeverLands = true;
    sessionResolved.value = false;
    const b = boot(clientFor('u_bob', null));
    await settle(200);
    dumpLedger('S3 user B boots in the same tab (B fetch never lands)');

    say(`S3 VERDICT: B rendered apps=${JSON.stringify(b.getByTestId('apps').textContent)} ` +
      `loading=${b.getByTestId('loading').textContent} ` +
      `seed-reads=${JSON.stringify(reads().map((r) => `${r.key} -> ${r.detail}`))} ` +
      `storage-now=${JSON.stringify(Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX)))}`);
  });
});

// ---------------------------------------------------------------------------
// S4 — auth DISABLED (the synthetic `guest` identity), not named on the card.
// ---------------------------------------------------------------------------

describe('S4 auth-disabled guest boot', () => {
  it('measures the principal scope when AuthProvider seeds a guest identity', async () => {
    serverApps = [{ name: 'setup' }];
    hasCookie = true;
    boot(clientFor('u_alice', 'tok-alice'), { enabled: false });
    await waitFor(() => expect(metaCalls).toContain('app'));
    await settle();
    dumpLedger('S4 auth-disabled guest boot');
    say(`S4: writes=${JSON.stringify(writes().map((w) => w.key))}`);
  });
});

// ---------------------------------------------------------------------------
// S5 — PREVIEW mode (the other synthetic identity), not named on the card.
// ---------------------------------------------------------------------------

describe('S5 preview-mode boot', () => {
  it('measures the principal scope when AuthProvider seeds a preview identity', async () => {
    serverApps = [{ name: 'setup' }];
    hasCookie = true;
    boot(clientFor('u_alice', 'tok-alice'), { previewMode: { simulatedRole: 'admin' } });
    await waitFor(() => expect(metaCalls).toContain('app'));
    await settle();
    dumpLedger('S5 preview-mode boot');
    say(`S5: writes=${JSON.stringify(writes().map((w) => w.key))}`);
  });
});
