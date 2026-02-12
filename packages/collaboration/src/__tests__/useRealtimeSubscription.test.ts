/**
 * Tests for useRealtimeSubscription hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtimeSubscription';

describe('useRealtimeSubscription', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns disconnected state when no WebSocket URL is provided', () => {
    const { result } = renderHook(() =>
      useRealtimeSubscription({ channel: 'test-room' }),
    );

    expect(result.current.connectionState).toBe('disconnected');
  });

  it('isConnected is false initially', () => {
    const { result } = renderHook(() =>
      useRealtimeSubscription({ channel: 'test-room' }),
    );

    expect(result.current.isConnected).toBe(false);
  });

  it('messages array is empty initially', () => {
    const { result } = renderHook(() =>
      useRealtimeSubscription({ channel: 'test-room' }),
    );

    expect(result.current.messages).toEqual([]);
  });

  it('lastMessage is null initially', () => {
    const { result } = renderHook(() =>
      useRealtimeSubscription({ channel: 'test-room' }),
    );

    expect(result.current.lastMessage).toBeNull();
  });
});
