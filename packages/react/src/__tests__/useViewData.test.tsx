/**
 * ObjectUI — useViewData Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useViewData } from '../hooks/useViewData';
import { SchemaRendererContext } from '../context/SchemaRendererContext';
import type { DataSource, ViewData, QueryResult } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Mock DataSource
// ---------------------------------------------------------------------------

function createMockDataSource(
  findResult: QueryResult<any> = { data: [], total: 0 },
): DataSource<any> {
  return {
    find: vi.fn().mockResolvedValue(findResult),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(true),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'test', fields: {} }),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContextWrapper(dataSource?: any) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      SchemaRendererContext.Provider,
      { value: { dataSource: dataSource ?? null } },
      children,
    );
}

// ---------------------------------------------------------------------------
// provider: 'value' (in-memory)
// ---------------------------------------------------------------------------

describe('useViewData — provider: value', () => {
  it('should load value data synchronously', async () => {
    const viewData: ViewData = {
      provider: 'value',
      items: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
    };

    const { result } = renderHook(() =>
      useViewData({ viewData, resource: 'users' }),
    );

    // Value provider resolves through the normal async path (Promise.resolve)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
    expect(result.current.dataSource).not.toBeNull();
  });

  it('should handle empty items', async () => {
    const viewData: ViewData = { provider: 'value', items: [] };

    const { result } = renderHook(() =>
      useViewData({ viewData, resource: 'users' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('should support filtering on value data', async () => {
    const viewData: ViewData = {
      provider: 'value',
      items: [
        { id: '1', name: 'Alice', role: 'admin' },
        { id: '2', name: 'Bob', role: 'user' },
        { id: '3', name: 'Charlie', role: 'admin' },
      ],
    };

    const { result } = renderHook(() =>
      useViewData({
        viewData,
        resource: 'users',
        params: { $filter: { role: 'admin' } },
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// provider: 'object' (context fallback)
// ---------------------------------------------------------------------------

describe('useViewData — provider: object', () => {
  it('should use context DataSource for object provider', async () => {
    const mockDS = createMockDataSource({
      data: [{ id: '1', name: 'Contact' }],
      total: 1,
    });

    const viewData: ViewData = { provider: 'object', object: 'contacts' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'contacts' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockDS.find).toHaveBeenCalledWith('contacts', undefined);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].name).toBe('Contact');
  });

  it('should not fetch when no context DataSource available', async () => {
    const viewData: ViewData = { provider: 'object', object: 'contacts' };

    const { result } = renderHook(() =>
      useViewData({ viewData, resource: 'contacts' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.dataSource).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Explicit DataSource override
// ---------------------------------------------------------------------------

describe('useViewData — explicit dataSource', () => {
  it('should use explicit dataSource over context', async () => {
    const contextDS = createMockDataSource();
    const explicitDS = createMockDataSource({
      data: [{ id: 'x' }],
      total: 1,
    });

    const { result } = renderHook(
      () =>
        useViewData({
          dataSource: explicitDS,
          resource: 'items',
        }),
      { wrapper: createContextWrapper(contextDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(explicitDS.find).toHaveBeenCalled();
    expect(contextDS.find).not.toHaveBeenCalled();
    expect(result.current.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// skip
// ---------------------------------------------------------------------------

describe('useViewData — skip', () => {
  it('should not fetch when skip is true', async () => {
    const mockDS = createMockDataSource();
    const viewData: ViewData = { provider: 'object', object: 'contacts' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'contacts', skip: true }),
      { wrapper: createContextWrapper(mockDS) },
    );

    // Should immediately be not-loading
    expect(result.current.loading).toBe(false);
    expect(mockDS.find).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

describe('useViewData — refresh', () => {
  it('should re-fetch data on refresh', async () => {
    let callCount = 0;
    const mockDS: DataSource<any> = {
      ...createMockDataSource(),
      find: vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          data: [{ id: String(callCount) }],
          total: 1,
        };
      }),
    };

    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'items' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data[0].id).toBe('1');

    // Trigger refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data[0].id).toBe('2');
    expect(mockDS.find).toHaveBeenCalledTimes(2);
  });

  it('should accept new params on refresh', async () => {
    const mockDS = createMockDataSource({ data: [], total: 0 });
    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'items' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh({ $top: 5, $filter: { status: 'active' } });
    });

    expect(mockDS.find).toHaveBeenLastCalledWith('items', {
      $top: 5,
      $filter: { status: 'active' },
    });
  });
});

// ---------------------------------------------------------------------------
// fetchOne
// ---------------------------------------------------------------------------

describe('useViewData — fetchOne', () => {
  it('should fetch a single record', async () => {
    const mockDS: DataSource<any> = {
      ...createMockDataSource(),
      findOne: vi.fn().mockResolvedValue({ id: '42', name: 'Found' }),
    };

    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'items' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let record: any;
    await act(async () => {
      record = await result.current.fetchOne('42');
    });

    expect(record).toEqual({ id: '42', name: 'Found' });
    expect(mockDS.findOne).toHaveBeenCalledWith('items', '42');
  });

  it('should return null when dataSource is not available', async () => {
    const { result } = renderHook(() =>
      useViewData({ resource: 'items' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let record: any;
    await act(async () => {
      record = await result.current.fetchOne('42');
    });

    expect(record).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('useViewData — errors', () => {
  it('should capture fetch errors', async () => {
    const mockDS: DataSource<any> = {
      ...createMockDataSource(),
      find: vi.fn().mockRejectedValue(new Error('Network failure')),
    };

    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'items' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
    expect(result.current.data).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('should wrap non-Error throws as Error', async () => {
    const mockDS: DataSource<any> = {
      ...createMockDataSource(),
      find: vi.fn().mockRejectedValue('string error'),
    };

    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'items' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });
});

// ---------------------------------------------------------------------------
// hasMore
// ---------------------------------------------------------------------------

describe('useViewData — hasMore', () => {
  it('should reflect hasMore from QueryResult', async () => {
    const mockDS = createMockDataSource({
      data: [{ id: '1' }],
      total: 100,
      hasMore: true,
    });

    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: 'items', params: { $top: 1 } }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
    expect(result.current.totalCount).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// No resource
// ---------------------------------------------------------------------------

describe('useViewData — edge cases', () => {
  it('should not fetch when resource is empty', async () => {
    const mockDS = createMockDataSource();
    const viewData: ViewData = { provider: 'object', object: 'items' };

    const { result } = renderHook(
      () => useViewData({ viewData, resource: '' }),
      { wrapper: createContextWrapper(mockDS) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockDS.find).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// provider: 'api' — host-authenticated fetch (#2725)
// ---------------------------------------------------------------------------

describe("useViewData — provider: 'api' host auth fetch", () => {
  const apiViewData: ViewData = {
    provider: 'api',
    read: { url: '/api/gantt/tree', method: 'GET' },
  } as ViewData;

  function jsonResponse() {
    return new Response(JSON.stringify({ data: [{ id: '1' }], total: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function apiFetchWrapper(apiFetch: typeof fetch) {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        SchemaRendererContext.Provider,
        { value: { dataSource: null, apiFetch } },
        children,
      );
  }

  it('routes api-provider requests through the context apiFetch', async () => {
    const apiFetch = vi.fn(async () => jsonResponse()) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useViewData({ viewData: apiViewData, resource: 'tasks' }),
      { wrapper: apiFetchWrapper(apiFetch) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(apiFetch).toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: '1' }]);
  });

  it('lets an explicit adapterOptions.fetch win over the context apiFetch', async () => {
    const contextFetch = vi.fn(async () => jsonResponse()) as unknown as typeof fetch;
    const explicitFetch = vi.fn(async () => jsonResponse()) as unknown as typeof fetch;

    const { result } = renderHook(
      () =>
        useViewData({
          viewData: apiViewData,
          resource: 'tasks',
          adapterOptions: { fetch: explicitFetch },
        }),
      { wrapper: apiFetchWrapper(contextFetch) },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(explicitFetch).toHaveBeenCalled();
    expect(contextFetch).not.toHaveBeenCalled();
  });
});
