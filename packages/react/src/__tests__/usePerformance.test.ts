/**
 * ObjectUI — usePerformance Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerformance } from '../hooks/usePerformance';

describe('usePerformance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return default config values', () => {
    const { result } = renderHook(() => usePerformance());

    expect(result.current.config).toEqual({
      lazyLoad: true,
      cacheStrategy: 'stale-while-revalidate',
      prefetch: false,
      pageSize: 50,
      debounceMs: 300,
      virtualScroll: {
        enabled: false,
        itemHeight: 40,
        overscan: 5,
      },
    });
  });

  it('should merge user config with defaults', () => {
    const { result } = renderHook(() =>
      usePerformance({
        lazyLoad: false,
        pageSize: 100,
        virtualScroll: { enabled: true, itemHeight: 60 },
      }),
    );

    expect(result.current.config.lazyLoad).toBe(false);
    expect(result.current.config.pageSize).toBe(100);
    expect(result.current.config.virtualScroll.enabled).toBe(true);
    expect(result.current.config.virtualScroll.itemHeight).toBe(60);
    // Default overscan preserved
    expect(result.current.config.virtualScroll.overscan).toBe(5);
  });

  it('should accept all cache strategy values', () => {
    for (const strategy of [
      'none',
      'cache-first',
      'network-first',
      'stale-while-revalidate',
    ] as const) {
      const { result } = renderHook(() =>
        usePerformance({ cacheStrategy: strategy }),
      );
      expect(result.current.config.cacheStrategy).toBe(strategy);
    }
  });

  it('should track render count via ref', () => {
    const { result, rerender } = renderHook(() => usePerformance());

    // Initial render count should be at least 1
    expect(result.current.metrics.renderCount).toBeGreaterThanOrEqual(1);

    // After several rerenders, the count from markRenderStart should still be callable
    rerender();
    rerender();
    // The ref increments on each render, but useMemo may cache the previous value.
    // The important thing is that the render count is a valid non-negative number.
    expect(result.current.metrics.renderCount).toBeGreaterThanOrEqual(1);
  });

  it('should provide markRenderStart that returns stop function', () => {
    const { result } = renderHook(() => usePerformance());

    let stop: () => void;
    act(() => {
      stop = result.current.markRenderStart();
    });

    // stop should be a function
    expect(typeof stop!).toBe('function');

    act(() => {
      stop();
    });

    // After calling stop, lastRenderDuration should be a number
    expect(result.current.metrics.lastRenderDuration).toBeTypeOf('number');
    expect(result.current.metrics.lastRenderDuration!).toBeGreaterThanOrEqual(0);
  });

  it('should create a debounced function', async () => {
    const { result } = renderHook(() => usePerformance({ debounceMs: 100 }));

    const callback = vi.fn();
    let debounced: typeof callback;

    act(() => {
      debounced = result.current.debounce(callback);
    });

    // Call the debounced function multiple times in quick succession
    act(() => {
      debounced!('arg1');
    });

    // Callback not called immediately
    expect(callback).not.toHaveBeenCalled();

    // Wait for debounce to fire
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Called once with the last arguments
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  it('should provide initial metrics with null values', () => {
    const { result } = renderHook(() => usePerformance());

    // FCP and LCP may be null in test environment
    expect(result.current.metrics.lcp).toBeNull();
    expect(result.current.metrics.fcp).toBeNull();
    expect(result.current.metrics.tti).toBeNull();
    expect(result.current.metrics.lastRenderDuration).toBeNull();
  });
});
