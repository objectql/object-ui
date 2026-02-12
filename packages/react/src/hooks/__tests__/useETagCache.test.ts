/**
 * Tests for useETagCache hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useETagCache } from '../useETagCache';

describe('useETagCache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear the module-scoped memory cache between tests
    const { result } = renderHook(() => useETagCache());
    act(() => {
      result.current.clearCache();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state with cacheSize: 0', () => {
    const { result } = renderHook(() => useETagCache());

    expect(result.current.cacheSize).toBe(0);
    expect(result.current.serviceWorkerActive).toBe(false);
    expect(result.current.fetchWithETag).toBeTypeOf('function');
    expect(result.current.invalidate).toBeTypeOf('function');
    expect(result.current.clearCache).toBeTypeOf('function');
  });

  it('fetchWithETag makes a network request and caches the response', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockHeaders = new Headers({ etag: '"abc123"' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: mockHeaders,
      }),
    );

    const { result } = renderHook(() => useETagCache());

    let response: { data: unknown; fromCache: boolean; etag?: string } | undefined;
    await act(async () => {
      response = await result.current.fetchWithETag('/api/test');
    });

    expect(response!.data).toEqual(mockData);
    expect(response!.fromCache).toBe(false);
    expect(response!.etag).toBe('"abc123"');
    expect(result.current.cacheSize).toBe(1);
  });

  it('fetchWithETag sends If-None-Match header on subsequent requests', async () => {
    const mockData = { id: 1 };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // First request — returns data with ETag
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: new Headers({ etag: '"etag-1"' }),
      }),
    );

    const { result } = renderHook(() => useETagCache());

    await act(async () => {
      await result.current.fetchWithETag('/api/data');
    });

    // Second request — server returns 304
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 304 }),
    );

    let response: { data: unknown; fromCache: boolean; etag?: string } | undefined;
    await act(async () => {
      response = await result.current.fetchWithETag('/api/data');
    });

    // Verify If-None-Match was sent
    const secondCallArgs = fetchSpy.mock.calls[1];
    const headers = secondCallArgs[1]?.headers as Headers;
    expect(headers.get('If-None-Match')).toBe('"etag-1"');
    expect(response!.fromCache).toBe(true);
    expect(response!.data).toEqual(mockData);
  });

  it('invalidate removes a specific cache entry', async () => {
    const mockData = { id: 1 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: new Headers({ etag: '"etag-x"' }),
      }),
    );

    const { result } = renderHook(() => useETagCache());

    await act(async () => {
      await result.current.fetchWithETag('/api/item');
    });
    expect(result.current.cacheSize).toBe(1);

    act(() => {
      result.current.invalidate('/api/item');
    });

    expect(result.current.cacheSize).toBe(0);
  });

  it('clearCache removes all entries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ a: 1 }), {
        status: 200,
        headers: new Headers({ etag: '"e1"' }),
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ b: 2 }), {
        status: 200,
        headers: new Headers({ etag: '"e2"' }),
      }),
    );

    const { result } = renderHook(() => useETagCache());

    await act(async () => {
      await result.current.fetchWithETag('/api/a');
    });
    await act(async () => {
      await result.current.fetchWithETag('/api/b');
    });

    expect(result.current.cacheSize).toBe(2);

    act(() => {
      result.current.clearCache();
    });

    expect(result.current.cacheSize).toBe(0);
  });

  it('serviceWorkerActive is false initially', () => {
    const { result } = renderHook(() => useETagCache());

    expect(result.current.serviceWorkerActive).toBe(false);
  });
});
