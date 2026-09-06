// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useEnvironmentEntitlements — the authoritative summary is read STRICTLY out
 * of the control plane's `{ success, data }` envelope (#3352).
 *
 * The control plane wraps every success body as `{ success, data }` (cloud#1046)
 * and `EnvironmentEntitlementsSummary` is declared as that `data` payload, so a
 * bare body is a producer contract violation rather than a second accepted
 * dialect. Reading one would hand back a summary whose every field is
 * `undefined` — a silent `hasProductionEnv: false` that tells a user with a
 * live production environment they have none. The strict read makes that shape
 * produce NO summary, so the hook degrades to the row-derived fallback, which
 * resolves the signal for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@object-ui/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({ activeOrganization: { id: 'org_1' } }),
}));

import { useEnvironmentEntitlements } from '../useEnvironmentEntitlements';

/** Env rows for the derived fallback — this org DOES own a production env. */
const PRODUCTION_ROWS = [{ id: 'env-1', environment_type: 'production', status: 'ready' }];

function setup(opts: { json: unknown; ok?: boolean; rows?: unknown[] }) {
  const authFetch = vi.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.ok === false ? 500 : 200,
    json: async () => opts.json,
  });
  const dataSource = { find: vi.fn().mockResolvedValue(opts.rows ?? PRODUCTION_ROWS) };
  const view = renderHook(() =>
    useEnvironmentEntitlements({ enabled: true, dataSource, authFetch, apiBase: '' }),
  );
  return { view, authFetch, dataSource };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEnvironmentEntitlements — envelope discipline', () => {
  it('reads the summary out of the `{ success, data }` envelope', async () => {
    const { view } = setup({
      json: { success: true, data: { hasProductionEnv: true, plan: 'pro' } },
    });

    await waitFor(() => expect(view.result.current?.ready).toBe(true));
    expect(view.result.current).toMatchObject({
      source: 'summary',
      hasProductionEnv: true,
      plan: 'pro',
    });
  });

  // The pin: a bare body must NOT produce a usable summary. Here the bare body
  // claims `hasProductionEnv: false` while the org's rows show a real
  // production env — so reading it would actively contradict reality. Strict
  // read ⇒ no summary ⇒ the derived fallback resolves `true`.
  it('does NOT read a bare (un-enveloped) body as a summary; falls back to rows', async () => {
    const { view, dataSource } = setup({
      json: { hasProductionEnv: false, plan: 'free' },
    });

    await waitFor(() => expect(view.result.current?.ready).toBe(true));
    expect(view.result.current).toMatchObject({ source: 'derived', hasProductionEnv: true });
    // `plan` only ever comes from the authoritative summary — the bare body's
    // `free` must not leak into the state.
    expect(view.result.current?.plan).toBeUndefined();
    expect(dataSource.find).toHaveBeenCalledWith('sys_environment', expect.anything());
  });

  it('does NOT read an envelope whose `data` payload is missing', async () => {
    const { view } = setup({ json: { success: true } });

    await waitFor(() => expect(view.result.current?.ready).toBe(true));
    expect(view.result.current).toMatchObject({ source: 'derived' });
  });

  it('still falls back to rows when the endpoint itself fails', async () => {
    const { view } = setup({ ok: false, json: null });

    await waitFor(() => expect(view.result.current?.ready).toBe(true));
    expect(view.result.current).toMatchObject({ source: 'derived', hasProductionEnv: true });
  });
});
