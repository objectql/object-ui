/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsiveConfig } from '../useResponsiveConfig';

describe('useResponsiveConfig', () => {
  it('returns defaults when no config is provided', () => {
    const { result } = renderHook(() => useResponsiveConfig());
    expect(result.current.hidden).toBe(false);
    expect(result.current.columns).toBeUndefined();
    expect(result.current.order).toBeUndefined();
    expect(result.current.breakpoint).toBeDefined();
  });

  it('returns defaults when undefined config is provided', () => {
    const { result } = renderHook(() => useResponsiveConfig(undefined));
    expect(result.current.hidden).toBe(false);
  });

  it('resolves columns from config', () => {
    const { result } = renderHook(() =>
      useResponsiveConfig({
        columns: { xs: 12, sm: 6, lg: 4 },
      }),
    );
    expect(result.current.columns).toBeTypeOf('number');
    expect(result.current.hidden).toBe(false);
  });

  it('resolves order from config', () => {
    const { result } = renderHook(() =>
      useResponsiveConfig({
        order: { xs: 2, lg: 1 },
      }),
    );
    expect(result.current.order).toBeTypeOf('number');
  });

  it('detects hidden breakpoints', () => {
    const { result } = renderHook(() =>
      useResponsiveConfig({
        hiddenOn: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      }),
    );
    // Should be hidden since all breakpoints are hidden
    expect(result.current.hidden).toBe(true);
  });

  it('not hidden when current breakpoint not in hiddenOn', () => {
    // Only hide on 'xs' — the default window width should be larger
    const { result } = renderHook(() =>
      useResponsiveConfig({
        hiddenOn: ['xs'],
      }),
    );
    // In happy-dom, default width is 1024 which is 'lg', so not hidden
    expect(result.current.hidden).toBe(false);
  });
});
