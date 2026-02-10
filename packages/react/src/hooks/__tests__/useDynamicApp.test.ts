/**
 * Tests for useDynamicApp hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDynamicApp } from '../useDynamicApp';

describe('useDynamicApp', () => {
  const staticConfig = {
    name: 'crm',
    label: 'CRM App',
    objects: ['contact', 'account'],
  };

  it('returns static config when no adapter is provided', () => {
    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm', staticConfig }),
    );

    expect(result.current.config).toEqual(staticConfig);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isServerConfig).toBe(false);
  });

  it('returns null config when neither adapter nor static config provided', () => {
    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm' }),
    );

    expect(result.current.config).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('loads config from server adapter', async () => {
    const serverConfig = { name: 'crm', label: 'CRM (Server)', objects: ['contact'] };
    const adapter = {
      getApp: vi.fn().mockResolvedValue(serverConfig),
    };

    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm', staticConfig, adapter }),
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.config).toEqual(serverConfig);
    expect(result.current.isServerConfig).toBe(true);
    expect(adapter.getApp).toHaveBeenCalledWith('crm');
  });

  it('falls back to static config when server returns null', async () => {
    const adapter = {
      getApp: vi.fn().mockResolvedValue(null),
    };

    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm', staticConfig, adapter }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.config).toEqual(staticConfig);
    expect(result.current.isServerConfig).toBe(false);
  });

  it('falls back to static config on server error', async () => {
    const adapter = {
      getApp: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm', staticConfig, adapter }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.config).toEqual(staticConfig);
    expect(result.current.isServerConfig).toBe(false);
    expect(result.current.error?.message).toBe('Network error');
  });

  it('skips loading when enabled is false', () => {
    const adapter = {
      getApp: vi.fn(),
    };

    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm', staticConfig, adapter, enabled: false }),
    );

    expect(result.current.config).toEqual(staticConfig);
    expect(result.current.isLoading).toBe(false);
    expect(adapter.getApp).not.toHaveBeenCalled();
  });

  it('refresh invalidates cache and re-fetches', async () => {
    let callCount = 0;
    const adapter = {
      getApp: vi.fn().mockImplementation(async () => {
        callCount++;
        return { name: 'crm', version: callCount };
      }),
      invalidateCache: vi.fn(),
    };

    const { result } = renderHook(() =>
      useDynamicApp({ appId: 'crm', adapter }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((result.current.config as any).version).toBe(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(adapter.invalidateCache).toHaveBeenCalledWith('app:crm');
    expect((result.current.config as any).version).toBe(2);
  });

  it('reloads when appId changes', async () => {
    const adapter = {
      getApp: vi.fn().mockImplementation(async (appId: string) => {
        return { name: appId };
      }),
    };

    const { result, rerender } = renderHook(
      ({ appId }: { appId: string }) =>
        useDynamicApp({ appId, adapter }),
      { initialProps: { appId: 'crm' } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((result.current.config as any).name).toBe('crm');

    rerender({ appId: 'erp' });

    await waitFor(() => {
      expect((result.current.config as any).name).toBe('erp');
    });

    expect(adapter.getApp).toHaveBeenCalledWith('erp');
  });
});
