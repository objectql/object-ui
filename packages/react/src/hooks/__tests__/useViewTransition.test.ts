/**
 * Tests for useViewTransition hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewTransition } from '../useViewTransition';

describe('useViewTransition', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isSupported as false when document.startViewTransition is not available', () => {
    const { result } = renderHook(() => useViewTransition());

    // happy-dom does not implement startViewTransition
    expect(result.current.isSupported).toBe(false);
  });

  it('returns isTransitioning as false initially', () => {
    const { result } = renderHook(() => useViewTransition());

    expect(result.current.isTransitioning).toBe(false);
  });

  it('startTransition calls callback without transition API (fallback behavior)', async () => {
    const { result } = renderHook(() => useViewTransition());

    const callback = vi.fn();

    await act(async () => {
      await result.current.startTransition(callback);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('respects enabled: false by calling callback directly', async () => {
    const { result } = renderHook(() =>
      useViewTransition({ enabled: false }),
    );

    const callback = vi.fn();

    await act(async () => {
      await result.current.startTransition(callback);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('transitionClass is empty initially', () => {
    const { result } = renderHook(() => useViewTransition());

    expect(result.current.transitionClass).toBe('');
  });
});
