/**
 * Tests for usePerformanceBudget hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerformanceBudget } from '../usePerformanceBudget';

describe('usePerformanceBudget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns default budget config when no config provided', () => {
    const { result } = renderHook(() => usePerformanceBudget());

    // Default snapshot values
    expect(result.current.snapshot).toEqual({
      lcp: null,
      fcp: null,
      memoryMB: null,
    });
    expect(result.current.clearViolations).toBeTypeOf('function');
    expect(result.current.checkMetric).toBeTypeOf('function');
    expect(result.current.trackRender).toBeTypeOf('function');
  });

  it('isWithinBudget is true initially (no violations)', () => {
    const { result } = renderHook(() => usePerformanceBudget());

    expect(result.current.isWithinBudget).toBe(true);
    expect(result.current.violations).toEqual([]);
  });

  it('trackRender records a violation when render exceeds maxRenderTime', () => {
    const { result } = renderHook(() =>
      usePerformanceBudget({ maxRenderTime: 16, warnOnViolation: false }),
    );

    act(() => {
      result.current.trackRender(50);
    });

    expect(result.current.violations).toHaveLength(1);
    expect(result.current.violations[0].metric).toBe('renderTime');
    expect(result.current.violations[0].actual).toBe(50);
    expect(result.current.violations[0].budget).toBe(16);
    expect(result.current.isWithinBudget).toBe(false);
  });

  it('trackRender does NOT record when render is within budget', () => {
    const { result } = renderHook(() =>
      usePerformanceBudget({ maxRenderTime: 16, warnOnViolation: false }),
    );

    let withinBudget: boolean = false;
    act(() => {
      withinBudget = result.current.trackRender(10);
    });

    expect(withinBudget).toBe(true);
    expect(result.current.violations).toHaveLength(0);
    expect(result.current.isWithinBudget).toBe(true);
  });

  it('checkMetric returns false for metrics exceeding budget', () => {
    const { result } = renderHook(() =>
      usePerformanceBudget({ maxLCP: 600, warnOnViolation: false }),
    );

    let withinBudget: boolean = true;
    act(() => {
      withinBudget = result.current.checkMetric('lcp', 800);
    });

    expect(withinBudget).toBe(false);
    expect(result.current.violations).toHaveLength(1);
    expect(result.current.violations[0].metric).toBe('lcp');
  });

  it('checkMetric returns true for metrics within budget', () => {
    const { result } = renderHook(() =>
      usePerformanceBudget({ maxLCP: 600, warnOnViolation: false }),
    );

    let withinBudget: boolean = false;
    act(() => {
      withinBudget = result.current.checkMetric('lcp', 400);
    });

    expect(withinBudget).toBe(true);
    expect(result.current.violations).toHaveLength(0);
  });

  it('clearViolations removes all violations', () => {
    const { result } = renderHook(() =>
      usePerformanceBudget({ maxRenderTime: 16, warnOnViolation: false }),
    );

    act(() => {
      result.current.trackRender(50);
    });
    expect(result.current.violations).toHaveLength(1);

    act(() => {
      result.current.clearViolations();
    });

    expect(result.current.violations).toHaveLength(0);
    expect(result.current.isWithinBudget).toBe(true);
  });

  it('deduplication: same metric type only recorded once', () => {
    const { result } = renderHook(() =>
      usePerformanceBudget({ maxRenderTime: 16, warnOnViolation: false }),
    );

    act(() => {
      result.current.trackRender(50);
    });
    act(() => {
      result.current.trackRender(100);
    });

    // Only one violation for 'renderTime' due to deduplication
    expect(result.current.violations).toHaveLength(1);
    expect(result.current.violations[0].metric).toBe('renderTime');
  });

  it('onViolation callback is called on budget violation', () => {
    const onViolation = vi.fn();
    const { result } = renderHook(() =>
      usePerformanceBudget({
        maxRenderTime: 16,
        warnOnViolation: false,
        onViolation,
      }),
    );

    act(() => {
      result.current.trackRender(50);
    });

    expect(onViolation).toHaveBeenCalledTimes(1);
    expect(onViolation).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'renderTime',
        budget: 16,
        actual: 50,
      }),
    );
  });
});
