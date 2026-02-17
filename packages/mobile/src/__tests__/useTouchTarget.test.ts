/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTouchTarget } from '../useTouchTarget';

describe('useTouchTarget', () => {
  it('returns WCAG defaults (44x44px) when no config is provided', () => {
    const { result } = renderHook(() => useTouchTarget());
    expect(result.current.style.minWidth).toBe('44px');
    expect(result.current.style.minHeight).toBe('44px');
    expect(result.current.style.padding).toBeUndefined();
    expect(result.current.className).toBe('touch-manipulation');
  });

  it('uses custom dimensions from config', () => {
    const { result } = renderHook(() =>
      useTouchTarget({ config: { minWidth: 48, minHeight: 48 } }),
    );
    expect(result.current.style.minWidth).toBe('48px');
    expect(result.current.style.minHeight).toBe('48px');
  });

  it('applies padding when specified', () => {
    const { result } = renderHook(() =>
      useTouchTarget({ config: { minWidth: 44, minHeight: 44, padding: 8 } }),
    );
    expect(result.current.style.padding).toBe('8px');
  });

  it('does not apply padding when 0', () => {
    const { result } = renderHook(() =>
      useTouchTarget({ config: { minWidth: 44, minHeight: 44, padding: 0 } }),
    );
    expect(result.current.style.padding).toBeUndefined();
  });

  it('always returns touch-manipulation className', () => {
    const { result } = renderHook(() =>
      useTouchTarget({ config: { minWidth: 100, minHeight: 100 } }),
    );
    expect(result.current.className).toBe('touch-manipulation');
  });
});
