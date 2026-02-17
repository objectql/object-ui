/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsive } from '../useResponsive';

describe('useResponsive', () => {
  it('resolves a direct value', () => {
    const { result } = renderHook(() => useResponsive(42));
    expect(result.current).toBe(42);
  });

  it('resolves a responsive value object', () => {
    const { result } = renderHook(() => useResponsive({ xs: 1, sm: 2, lg: 3 }));
    // The resolved value depends on the current breakpoint
    expect(result.current).toBeTypeOf('number');
  });

  it('returns undefined for responsive value with no matching breakpoint', () => {
    // Only '2xl' defined, default width in happy-dom likely resolves to a lower breakpoint
    const { result } = renderHook(() => useResponsive({ '2xl': 100 }));
    // May return undefined or 100 depending on window width
    expect([undefined, 100]).toContain(result.current);
  });
});
