/**
 * Tests for useDiscovery hook
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiscovery } from '../useDiscovery';
import { SchemaRendererContext } from '../../context/SchemaRendererContext';

function createWrapper(dataSource: any) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      SchemaRendererContext.Provider,
      { value: { dataSource } },
      children,
    );
}

describe('useDiscovery', () => {
  it('returns isLoading false and null discovery when no context is provided', async () => {
    const { result } = renderHook(() => useDiscovery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.discovery).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns isLoading false and null discovery when dataSource has no getDiscovery method', async () => {
    const dataSource = { someOtherMethod: vi.fn() };

    const { result } = renderHook(() => useDiscovery(), {
      wrapper: createWrapper(dataSource),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.discovery).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('successfully fetches discovery data from dataSource.getDiscovery()', async () => {
    const discoveryData = {
      name: 'test-server',
      version: '1.0.0',
      services: {
        auth: { enabled: true, status: 'available' as const },
        data: { enabled: true, status: 'available' as const },
      },
    };

    const dataSource = {
      getDiscovery: vi.fn().mockResolvedValue(discoveryData),
    };

    const { result } = renderHook(() => useDiscovery(), {
      wrapper: createWrapper(dataSource),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.discovery).toEqual(discoveryData);
    expect(result.current.error).toBeNull();
    expect(dataSource.getDiscovery).toHaveBeenCalled();
  });

  it('handles errors from getDiscovery gracefully', async () => {
    const dataSource = {
      getDiscovery: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    const { result } = renderHook(() => useDiscovery(), {
      wrapper: createWrapper(dataSource),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.discovery).toBeNull();
    expect(result.current.error?.message).toBe('Network error');
  });

  it('isAuthEnabled defaults to true when no discovery', async () => {
    const { result } = renderHook(() => useDiscovery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthEnabled).toBe(true);
  });

  it('isAuthEnabled reflects the auth service enabled state', async () => {
    const discoveryData = {
      services: {
        auth: { enabled: false },
      },
    };

    const dataSource = {
      getDiscovery: vi.fn().mockResolvedValue(discoveryData),
    };

    const { result } = renderHook(() => useDiscovery(), {
      wrapper: createWrapper(dataSource),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthEnabled).toBe(false);
  });

  it('cleans up on unmount (cancelled flag)', async () => {
    let resolveDiscovery: (value: any) => void;
    const discoveryPromise = new Promise((resolve) => {
      resolveDiscovery = resolve;
    });

    const dataSource = {
      getDiscovery: vi.fn().mockReturnValue(discoveryPromise),
    };

    const { result, unmount } = renderHook(() => useDiscovery(), {
      wrapper: createWrapper(dataSource),
    });

    expect(result.current.isLoading).toBe(true);

    unmount();

    // Resolve after unmount — state should not update
    resolveDiscovery!({ name: 'late-response' });

    // Discovery should remain null since the component was unmounted
    expect(result.current.discovery).toBeNull();
  });
});
