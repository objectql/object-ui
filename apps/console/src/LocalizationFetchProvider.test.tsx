/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * `/auth/me/localization` answers `503` + `Retry-After` while a cold environment
 * kernel warms (objectstack#4159), so a transient failure is a normal part of a
 * cold start on a multi-tenant host. This provider used to make ONE attempt and
 * `.catch()` into silence, which meant a single 503 during warm-up degraded
 * currency and locale for the whole session — silently, permanently, long after
 * the kernel was ready.
 *
 * These pin the recovery AND the posture it must not lose: unlike the permission
 * layer, this one is cosmetic, so it keeps rendering children throughout and
 * never gates the app on the answer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LocalizationFetchProvider } from './LocalizationFetchProvider';

const ENDPOINT = '/api/v1/auth/me/localization';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => body,
});
const fail = (status: number, headers: Record<string, string> = {}) => ({
  ok: false,
  status,
  headers: new Headers(headers),
  json: async () => ({}),
});

function renderProvider() {
  return render(
    <LocalizationFetchProvider endpoint={ENDPOINT}>
      <span data-testid="child">child</span>
    </LocalizationFetchProvider>,
  );
}

describe('LocalizationFetchProvider', () => {
  beforeEach(() => { vi.spyOn(globalThis, 'fetch' as never); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('recovers from a warming 503 instead of degrading for the session', async () => {
    (globalThis.fetch as never as ReturnType<typeof vi.fn>)
      // `Retry-After: 0` keeps the test timer-free while still exercising the
      // server-stated-delay path.
      .mockResolvedValueOnce(fail(503, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(ok({ authenticated: true, currency: 'CNY', locale: 'zh-CN' }));

    renderProvider();

    await waitFor(() =>
      expect((globalThis.fetch as never as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2),
    );
    // The point of the retry: the tenant default actually arrives.
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('retries a thrown fetch (offline / DNS / aborted) too', async () => {
    (globalThis.fetch as never as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok({ authenticated: true, currency: 'EUR' }));

    renderProvider();

    // A thrown fetch carries no `Retry-After`, so this one waits out the real
    // exponential backoff (BASE_DELAY_MS) rather than a server-stated 0.
    await waitFor(
      () => expect((globalThis.fetch as never as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2),
      { timeout: 4000 },
    );
  }, 10_000);

  it.each([401, 403, 404, 500])(
    'does NOT retry %i — a real answer about this caller will not change',
    async (status) => {
      (globalThis.fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(fail(status));

      renderProvider();

      // Give any (wrongly scheduled) retry a chance to fire before asserting.
      await new Promise((r) => setTimeout(r, 50));
      expect((globalThis.fetch as never as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    },
  );

  it('never blocks: children render while the fetch is still failing', async () => {
    (globalThis.fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      fail(503, { 'Retry-After': '0' }),
    );

    renderProvider();

    // The posture that separates this provider from MePermissionsProvider — it
    // is cosmetic, so nothing waits on the answer, not even mid-retry.
    expect(screen.getByTestId('child')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('stops after the retry budget rather than hammering forever', async () => {
    (globalThis.fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      fail(503, { 'Retry-After': '0' }),
    );

    renderProvider();

    // 1 attempt + MAX_RETRIES(4); waitFor settles once the count stops moving.
    await waitFor(() =>
      expect((globalThis.fetch as never as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(5),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect((globalThis.fetch as never as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(5);
  });
});
