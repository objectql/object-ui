/**
 * Tests for createAuthenticatedFetch — header injection (auth, tenant, locale).
 *
 * Lives as a `.test.tsx` so it runs under happy-dom (the repo routes `.test.ts`
 * to the node environment), giving us a real `document` for the
 * `Accept-Language` ← `<html lang>` behaviour added for issue #1319.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthenticatedFetch, ActiveOrganizationStorage } from '../createAuthenticatedFetch';
import { TokenStorage } from '../createAuthClient';

const API_URL = 'http://localhost/api/v1/meta/object/account';

/** Stub the global fetch and capture the Headers it was called with. */
function stubFetch() {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    calls.push({ url, headers: new Headers(init?.headers) });
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', mock);
  return calls;
}

describe('createAuthenticatedFetch', () => {
  beforeEach(() => {
    ActiveOrganizationStorage.clear();
    vi.spyOn(TokenStorage, 'get').mockReturnValue(null);
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('injects the Bearer token on API calls', async () => {
    vi.spyOn(TokenStorage, 'get').mockReturnValue('tok123');
    const calls = stubFetch();
    await createAuthenticatedFetch()(API_URL);
    expect(calls[0].headers.get('Authorization')).toBe('Bearer tok123');
  });

  it('does not inject the token on non-API URLs', async () => {
    vi.spyOn(TokenStorage, 'get').mockReturnValue('tok123');
    const calls = stubFetch();
    await createAuthenticatedFetch()('http://localhost/static/logo.png');
    expect(calls[0].headers.get('Authorization')).toBeNull();
  });

  it('injects the tenant header when an active organization is set', async () => {
    ActiveOrganizationStorage.set('org-42');
    const calls = stubFetch();
    await createAuthenticatedFetch()(API_URL);
    expect(calls[0].headers.get('X-Tenant-ID')).toBe('org-42');
  });

  it('folds the active <html lang> into Accept-Language on API calls (#1319)', async () => {
    document.documentElement.lang = 'zh-CN';
    const calls = stubFetch();
    await createAuthenticatedFetch()(API_URL);
    expect(calls[0].headers.get('Accept-Language')).toBe('zh-CN');
  });

  it('does not set Accept-Language when <html lang> is empty', async () => {
    const calls = stubFetch();
    await createAuthenticatedFetch()(API_URL);
    expect(calls[0].headers.get('Accept-Language')).toBeNull();
  });

  it('does not set Accept-Language on non-API URLs', async () => {
    document.documentElement.lang = 'zh-CN';
    const calls = stubFetch();
    await createAuthenticatedFetch()('http://localhost/static/logo.png');
    expect(calls[0].headers.get('Accept-Language')).toBeNull();
  });

  it('never clobbers an Accept-Language the caller set explicitly', async () => {
    document.documentElement.lang = 'zh-CN';
    const calls = stubFetch();
    await createAuthenticatedFetch()(API_URL, { headers: { 'Accept-Language': 'ja' } });
    expect(calls[0].headers.get('Accept-Language')).toBe('ja');
  });
});

describe('createAuthenticatedFetch — cloud_control cross-org signal (platformScope)', () => {
  const DATA_ENV = 'http://localhost/api/v1/data/sys_environment';

  beforeEach(() => {
    ActiveOrganizationStorage.clear();
    vi.spyOn(TokenStorage, 'get').mockReturnValue(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/'); // reset route between tests
  });

  const inApp = (appName: string) => window.history.pushState({}, '', `/apps/${appName}/sys_environment`);

  it('appends platformScope=all for a cross-org object while in the cloud_control app', async () => {
    inApp('cloud_control');
    const calls = stubFetch();
    await createAuthenticatedFetch()(DATA_ENV);
    expect(calls[0].url).toBe(`${DATA_ENV}?platformScope=all`);
  });

  it('uses & when the request already has a query string', async () => {
    inApp('cloud_control');
    const calls = stubFetch();
    await createAuthenticatedFetch()(`${DATA_ENV}?top=50`);
    expect(calls[0].url).toBe(`${DATA_ENV}?top=50&platformScope=all`);
  });

  it('honors a basename prefix in the route (/_console/apps/cloud_control/…)', async () => {
    window.history.pushState({}, '', '/_console/apps/cloud_control/sys_team');
    const calls = stubFetch();
    await createAuthenticatedFetch()('http://localhost/api/v1/data/sys_team');
    expect(calls[0].url).toContain('platformScope=all');
  });

  it('does NOT append for a non-cross-org object, even in cloud_control', async () => {
    inApp('cloud_control');
    const calls = stubFetch();
    await createAuthenticatedFetch()('http://localhost/api/v1/data/sys_user');
    expect(calls[0].url).toBe('http://localhost/api/v1/data/sys_user');
  });

  it('does NOT append a partial-name match (sys_environment_log) — exact segment only', async () => {
    inApp('cloud_control');
    const calls = stubFetch();
    await createAuthenticatedFetch()('http://localhost/api/v1/data/sys_environment_log');
    expect(calls[0].url).not.toContain('platformScope');
  });

  it('still matches sys_environment_member (whitelisted) distinctly from sys_environment', async () => {
    inApp('cloud_control');
    const calls = stubFetch();
    await createAuthenticatedFetch()('http://localhost/api/v1/data/sys_environment_member');
    expect(calls[0].url).toContain('platformScope=all');
  });

  it('does NOT append when a different app is active', async () => {
    inApp('crm');
    const calls = stubFetch();
    await createAuthenticatedFetch()(DATA_ENV);
    expect(calls[0].url).toBe(DATA_ENV);
  });

  it('does not double-append when the caller already set platformScope', async () => {
    inApp('cloud_control');
    const calls = stubFetch();
    await createAuthenticatedFetch()(`${DATA_ENV}?platformScope=all`);
    expect(calls[0].url).toBe(`${DATA_ENV}?platformScope=all`);
  });
});
