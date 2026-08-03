/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * `createConsoleServerActionHandler` (#2904) — the console wrapper around
 * core's `createServerActionHandler`. The dispatch protocol itself is pinned in
 * core (`serverActionHandler.test.ts`); these cover the DOM choreography the
 * wrapper owns: the popup pre-open dance, the zero-roundtrip `newTabUrl` fast
 * path, the `redirectUrl` convention, and tab cleanup on every failure path.
 * `useConsoleActionRuntime.test.tsx` covers the same wrapper mounted in the
 * real console runtime.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('sonner', () => {
  const fn: any = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  return { toast: fn };
});

import { toast } from 'sonner';
import { createConsoleServerActionHandler } from '../consoleServerAction';

/** A pre-openable tab stub with the surface the wrapper drives. */
function makeTab() {
  return {
    document: { write: vi.fn(), close: vi.fn() },
    close: vi.fn(),
    location: { href: '' },
  } as unknown as Window & { close: ReturnType<typeof vi.fn>; location: { href: string } };
}

function okFetch(body: unknown = { success: true, data: {} }) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
}

function makeHandler(overrides: Partial<Parameters<typeof createConsoleServerActionHandler>[0]> = {}) {
  const fetch = overrides.fetch ?? (okFetch() as any);
  const onRefresh = overrides.onRefresh ?? vi.fn();
  const handler = createConsoleServerActionHandler({
    fetch,
    baseUrl: () => 'https://api.test',
    resolveObject: () => 'env',
    onRefresh,
    ...overrides,
  });
  return { handler, fetch: fetch as ReturnType<typeof okFetch>, onRefresh: onRefresh as ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.restoreAllMocks();
  (toast as any).mockClear?.();
});

describe('newTabUrl fast path (zero roundtrip)', () => {
  it('drives the pre-opened tab straight to the endpoint — no POST at all', async () => {
    const tab = makeTab();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { handler, fetch, onRefresh } = makeHandler();

    const res = await handler({
      type: 'script', name: 'sso_as_owner', opensInNewTab: true,
      newTabUrl: '/api/v1/cloud/environments/{recordId}/sso-open',
      params: { recordId: 'env 1' },
    } as any);

    expect(res).toEqual({ success: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(tab.location.href).toBe('https://api.test/api/v1/cloud/environments/env%201/sso-open');
    // Fast path refreshes only on an EXPLICIT refreshAfter: true.
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refreshes when the action explicitly opts in (refreshAfter: true)', async () => {
    vi.spyOn(window, 'open').mockReturnValue(makeTab() as any);
    const { handler, onRefresh } = makeHandler();

    await handler({
      type: 'script', name: 'sso_as_owner', opensInNewTab: true, refreshAfter: true,
      newTabUrl: '/sso-open/{recordId}', params: { recordId: 'e1' },
    } as any);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a blocked record resolution errors BEFORE any tab opens (no flash)', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const { handler, fetch } = makeHandler();

    const res = await handler(
      { type: 'script', name: 'sso_as_owner', opensInNewTab: true, newTabUrl: '/sso-open/{recordId}' } as any,
      { selectedRecords: [{ id: 'a' }, { id: 'b' }] } as any,
    );

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/exactly one row/i);
    expect(openSpy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('errors without a tab when no record id is resolvable', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const { handler } = makeHandler();

    const res = await handler({
      type: 'script', name: 'sso_as_owner', opensInNewTab: true, newTabUrl: '/sso-open/{recordId}',
    } as any);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no record id available/i);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('honors an injected resolveRecordId (record-page policy) on the fast path', async () => {
    const tab = makeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { handler } = makeHandler({
      resolveRecordId: (action: any) => ({ recordId: action.recordId ?? 'page_rec' }),
    });

    await handler({
      type: 'script', name: 'sso_as_owner', opensInNewTab: true, newTabUrl: '/sso-open/{recordId}',
    } as any);

    expect(tab.location.href).toBe('https://api.test/sso-open/page_rec');
  });
});

describe('redirectUrl convention', () => {
  it('drives the pre-opened tab to a handler-returned redirectUrl (legacy double-wrap read)', async () => {
    const tab = makeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { handler } = makeHandler({
      fetch: okFetch({
        success: true,
        data: { success: true, data: { redirectUrl: 'https://example.test/sso' } },
      }) as any,
    });

    const res = await handler({ type: 'script', name: 'open_env', opensInNewTab: true, params: { recordId: 'e1' } } as any);

    expect(res.success).toBe(true);
    expect(tab.location.href).toBe('https://example.test/sso');
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('opens lazily without a pre-opened tab, with a toast fallback when the popup is blocked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { handler } = makeHandler({
      fetch: okFetch({
        success: true,
        data: { success: true, data: { redirectUrl: 'https://example.test/sso' } },
      }) as any,
    });

    await handler({ type: 'script', name: 'open_env' } as any); // no opensInNewTab

    expect(openSpy).toHaveBeenCalledWith('https://example.test/sso', '_blank');
    expect(toast).toHaveBeenCalledTimes(1); // popup blocked → one-click fallback
  });

  it('closes the optimistically pre-opened tab when the handler returns no redirectUrl', async () => {
    const tab = makeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { handler } = makeHandler();

    const res = await handler({ type: 'script', name: 'noop', opensInNewTab: true, params: { recordId: 'e1' } } as any);

    expect(res.success).toBe(true);
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
});

describe('failure paths close the pre-opened tab', () => {
  it('on a failed dispatch', async () => {
    const tab = makeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { handler } = makeHandler({
      fetch: vi.fn(async () => ({
        ok: false, status: 403, json: async () => ({ success: false, error: 'Denied' }),
      })) as any,
    });

    const res = await handler({ type: 'script', name: 'open_env', opensInNewTab: true, params: { recordId: 'e1' } } as any);

    expect(res).toMatchObject({ success: false, error: 'Denied' });
    expect(tab.close).toHaveBeenCalledTimes(1);
    // The runner's post-execution hook owns the error toast — none here.
    expect((toast as any).error).not.toHaveBeenCalled();
  });

  it('on a thrown transport error', async () => {
    const tab = makeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { handler } = makeHandler({
      fetch: vi.fn(async () => { throw new Error('network down'); }) as any,
    });

    const res = await handler({ type: 'script', name: 'open_env', opensInNewTab: true, params: { recordId: 'e1' } } as any);

    expect(res).toEqual({ success: false, error: 'network down' });
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
});
