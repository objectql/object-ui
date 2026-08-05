// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * provisionProductionEnvironment — born-with-env contract.
 *
 *   - posts `Production` + the explicit org id to the cloud env endpoint;
 *   - resolves the created env on 2xx;
 *   - treats 403/409 ("org already has its production env" — e.g. the control
 *     plane's auto-default-environment plugin won the race) as SUCCESS
 *     (`alreadyProvisioned`), NOT a failure;
 *   - throws only on a genuine failure (5xx) so the caller can fall back to the
 *     lazy onboarding gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const authFetch = vi.fn();
vi.mock('@object-ui/auth', () => ({
  createAuthenticatedFetch: () => authFetch,
}));
vi.mock('../../../runtime-config', () => ({
  getCloudBase: () => '',
}));

import { provisionProductionEnvironment } from '../provisionEnvironment';

function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provisionProductionEnvironment', () => {
  it('posts Production + the org id to the cloud env endpoint and returns the env', async () => {
    authFetch.mockResolvedValue(res(200, { data: { id: 'env-1', hostname: 'os-abc.localhost' } }));

    const out = await provisionProductionEnvironment({ organizationId: 'org-123' });

    expect(authFetch).toHaveBeenCalledTimes(1);
    const [url, init] = authFetch.mock.calls[0];
    expect(String(url)).toContain('/api/v1/cloud/environments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ displayName: 'Production', organizationId: 'org-123' });
    expect(out).toMatchObject({ id: 'env-1', hostname: 'os-abc.localhost' });
  });

  it('treats 403 (already has its production env) as success, not a failure', async () => {
    authFetch.mockResolvedValue(res(403, { success: false, error: 'PRODUCTION_ENV_LIMIT' }));

    const out = await provisionProductionEnvironment({ organizationId: 'org-123' });

    expect(out).toEqual({ alreadyProvisioned: true });
  });

  // Strict envelope pin (#3352): the control plane wraps success payloads as
  // `{ success, data }`, so a BARE body is a producer contract violation — it
  // must NOT be read as the provisioned environment. This used to fall through
  // to `return body`, reporting a successful provision from a shape that never
  // existed; now it throws into the caller's documented lazy-provision path.
  it('does NOT read a bare (un-enveloped) 2xx body as the provisioned env', async () => {
    authFetch.mockResolvedValue(res(200, { id: 'env-1', hostname: 'os-abc.localhost' }));

    await expect(provisionProductionEnvironment({ organizationId: 'org-123' })).rejects.toThrow(
      /envelope/i,
    );
  });

  it('throws when a 2xx body carries the envelope but no data payload', async () => {
    authFetch.mockResolvedValue(res(200, { success: true }));

    await expect(provisionProductionEnvironment({ organizationId: 'org-123' })).rejects.toThrow(
      /envelope/i,
    );
  });

  it('throws on a genuine failure so the caller can fall back to the lazy gate', async () => {
    authFetch.mockResolvedValue(res(500, { success: false }));

    await expect(provisionProductionEnvironment({ organizationId: 'org-123' })).rejects.toThrow(
      /status 500/,
    );
  });
});
