/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * useAiUsage (ADR-0057 #8) — fetches the D5-safe per-meter usage fractions, is
 * inert without an apiBase, fails soft on a non-2xx / missing endpoint, and
 * refetches on the chat engine's post-turn / 429 nudge.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAiUsage } from '../useAiUsage';
import { AI_USAGE_REFRESH_EVENT } from '@object-ui/plugin-chatbot';

const RESP = {
  meters: {
    build: { planType: 'free', fraction: 0.5, unmetered: false, resetKind: 'daily', resetsAt: null, upgrade: true, topUp: false },
    dataChat: { planType: 'free', fraction: 0.2, unmetered: false, resetKind: 'daily', resetsAt: null, upgrade: true, topUp: false },
  },
};

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe('useAiUsage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches {apiBase}/usage with credentials and exposes the parsed meters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(RESP));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiUsage({ apiBase: '/api/v1/ai' }));

    await waitFor(() => expect(result.current.usage).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ai/usage',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(result.current.usage!.meters.build.fraction).toBe(0.5);
    expect(result.current.usage!.meters.dataChat.fraction).toBe(0.2);
  });

  it('fails soft on a non-2xx (endpoint absent on an older backend) — usage stays null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiUsage({ apiBase: '/api/v1/ai' }));

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.usage).toBeNull();
  });

  it('is inert without an apiBase (no fetch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiUsage({ apiBase: undefined }));
    // give any effect a tick
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.usage).toBeNull();
  });

  it('refetches on the AI_USAGE_REFRESH_EVENT nudge (post-turn / 429)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(RESP));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useAiUsage({ apiBase: '/api/v1/ai' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new CustomEvent(AI_USAGE_REFRESH_EVENT));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
