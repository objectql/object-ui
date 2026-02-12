/**
 * ObjectUI — useOffline Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOffline } from '../hooks/useOffline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'objectui-offline-queue';

function mockOnlineStatus(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true,
  });
}

function triggerOnline() {
  mockOnlineStatus(true);
  window.dispatchEvent(new Event('online'));
}

function triggerOffline() {
  mockOnlineStatus(false);
  window.dispatchEvent(new Event('offline'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOffline', () => {
  beforeEach(() => {
    mockOnlineStatus(true);
    localStorage.removeItem(QUEUE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should default to online with empty queue', () => {
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.enabled).toBe(true);
    expect(result.current.syncState).toBe('idle');
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.showIndicator).toBe(false);
    expect(result.current.strategy).toBe('network_first');
  });

  it('should detect offline status', () => {
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      triggerOffline();
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.showIndicator).toBe(true);
  });

  it('should detect coming back online', () => {
    mockOnlineStatus(false);
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      triggerOnline();
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.showIndicator).toBe(false);
  });

  it('should queue mutations', () => {
    const { result } = renderHook(() => useOffline());

    act(() => {
      result.current.queueMutation({
        operation: 'create',
        resource: 'users',
        data: { name: 'Alice' },
      });
    });

    expect(result.current.pendingCount).toBe(1);

    act(() => {
      result.current.queueMutation({
        operation: 'update',
        resource: 'users',
        data: { id: '1', name: 'Bob' },
      });
    });

    expect(result.current.pendingCount).toBe(2);
  });

  it('should clear the mutation queue', () => {
    const { result } = renderHook(() => useOffline());

    act(() => {
      result.current.queueMutation({ operation: 'create', resource: 'users' });
      result.current.queueMutation({ operation: 'delete', resource: 'users' });
    });

    expect(result.current.pendingCount).toBe(2);

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.pendingCount).toBe(0);
  });

  it('should enforce queueMaxSize', () => {
    const { result } = renderHook(() => useOffline({ queueMaxSize: 2 }));

    act(() => {
      result.current.queueMutation({ operation: 'create', resource: 'a' });
      result.current.queueMutation({ operation: 'create', resource: 'b' });
      result.current.queueMutation({ operation: 'create', resource: 'c' });
    });

    expect(result.current.pendingCount).toBe(2);
  });

  it('should respect custom config values', () => {
    const { result } = renderHook(() =>
      useOffline({
        strategy: 'cache_first',
        offlineIndicator: false,
        offlineMessage: 'Custom message',
      }),
    );

    expect(result.current.strategy).toBe('cache_first');
    expect(result.current.offlineMessage).toBe('Custom message');

    act(() => {
      triggerOffline();
    });

    // offlineIndicator is false, so showIndicator should be false even when offline
    expect(result.current.showIndicator).toBe(false);
  });

  it('should not queue mutations when disabled', () => {
    const { result } = renderHook(() => useOffline({ enabled: false }));

    act(() => {
      result.current.queueMutation({ operation: 'create', resource: 'users' });
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.enabled).toBe(false);
  });

  it('should sync mutations', async () => {
    const { result } = renderHook(() => useOffline());

    act(() => {
      result.current.queueMutation({ operation: 'create', resource: 'users' });
    });

    expect(result.current.pendingCount).toBe(1);

    await act(async () => {
      await result.current.sync();
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.syncState).toBe('idle');
  });

  it('should persist queue to localStorage', () => {
    const { result } = renderHook(() => useOffline());

    act(() => {
      result.current.queueMutation({ operation: 'create', resource: 'users' });
    });

    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].resource).toBe('users');
  });
});
