/**
 * ObjectUI — usePageTransition Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageTransition } from '../hooks/usePageTransition';

// ---------------------------------------------------------------------------
// matchMedia mock helper
// ---------------------------------------------------------------------------

function mockMatchMedia(reducedMotion: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: reducedMotion,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return { mql, listeners };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePageTransition', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return inactive result for default (none) type', () => {
    const { result } = renderHook(() => usePageTransition());

    expect(result.current.isActive).toBe(false);
    expect(result.current.type).toBe('none');
    expect(result.current.enterClassName).toBe('');
    expect(result.current.exitClassName).toBe('');
    expect(result.current.enterStyle).toEqual({});
    expect(result.current.exitStyle).toEqual({});
  });

  it('should generate fade transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'fade', duration: 200 }),
    );

    expect(result.current.isActive).toBe(true);
    expect(result.current.enterClassName).toContain('animate-in');
    expect(result.current.enterClassName).toContain('fade-in');
    expect(result.current.exitClassName).toContain('animate-out');
    expect(result.current.exitClassName).toContain('fade-out');
    expect(result.current.enterStyle.animationDuration).toBe('200ms');
    expect(result.current.duration).toBe(200);
  });

  it('should generate slide_up transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'slide_up' }),
    );

    expect(result.current.isActive).toBe(true);
    expect(result.current.enterClassName).toContain('slide-in-from-bottom');
    expect(result.current.exitClassName).toContain('slide-out-to-top');
  });

  it('should generate slide_down transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'slide_down' }),
    );

    expect(result.current.enterClassName).toContain('slide-in-from-top');
    expect(result.current.exitClassName).toContain('slide-out-to-bottom');
  });

  it('should generate slide_left transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'slide_left' }),
    );

    expect(result.current.enterClassName).toContain('slide-in-from-right');
    expect(result.current.exitClassName).toContain('slide-out-to-left');
  });

  it('should generate slide_right transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'slide_right' }),
    );

    expect(result.current.enterClassName).toContain('slide-in-from-left');
    expect(result.current.exitClassName).toContain('slide-out-to-right');
  });

  it('should generate scale transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'scale' }),
    );

    expect(result.current.enterClassName).toContain('zoom-in');
    expect(result.current.exitClassName).toContain('zoom-out');
  });

  it('should generate rotate transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'rotate' }),
    );

    expect(result.current.enterClassName).toContain('spin-in');
    expect(result.current.exitClassName).toContain('spin-out');
  });

  it('should generate flip transition classes', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'flip' }),
    );

    expect(result.current.isActive).toBe(true);
    expect(result.current.enterClassName).toContain('fade-in');
    expect(result.current.exitClassName).toContain('fade-out');
  });

  it('should apply custom easing', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'fade', easing: 'spring' }),
    );

    expect(result.current.enterStyle.animationTimingFunction).toBe(
      'cubic-bezier(0.34, 1.56, 0.64, 1)',
    );
  });

  it('should apply custom duration', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'fade', duration: 500 }),
    );

    expect(result.current.enterStyle.animationDuration).toBe('500ms');
    expect(result.current.duration).toBe(500);
  });

  it('should use default duration of 300ms', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'fade' }),
    );

    expect(result.current.duration).toBe(300);
    expect(result.current.enterStyle.animationDuration).toBe('300ms');
  });

  it('should disable transitions when reduced motion is preferred', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() =>
      usePageTransition({ type: 'fade', duration: 200 }),
    );

    expect(result.current.isActive).toBe(false);
    expect(result.current.enterClassName).toBe('');
    expect(result.current.exitClassName).toBe('');
    expect(result.current.enterStyle).toEqual({});
    expect(result.current.exitStyle).toEqual({});
  });

  it('should set animationFillMode to both', () => {
    const { result } = renderHook(() =>
      usePageTransition({ type: 'fade' }),
    );

    expect(result.current.enterStyle.animationFillMode).toBe('both');
    expect(result.current.exitStyle.animationFillMode).toBe('both');
  });

  it('should support all easing values', () => {
    const easings = [
      { input: 'linear' as const, expected: 'linear' },
      { input: 'ease' as const, expected: 'ease' },
      { input: 'ease_in' as const, expected: 'ease-in' },
      { input: 'ease_out' as const, expected: 'ease-out' },
      { input: 'ease_in_out' as const, expected: 'ease-in-out' },
    ];

    for (const { input, expected } of easings) {
      const { result } = renderHook(() =>
        usePageTransition({ type: 'fade', easing: input }),
      );
      expect(result.current.enterStyle.animationTimingFunction).toBe(expected);
    }
  });
});
