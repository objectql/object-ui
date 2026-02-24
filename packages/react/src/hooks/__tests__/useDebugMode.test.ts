/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebugMode } from '../useDebugMode';

describe('useDebugMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to disabled when no URL params are present', () => {
    const { result } = renderHook(() => useDebugMode());
    expect(result.current.enabled).toBe(false);
    expect(result.current.flags.enabled).toBe(false);
  });

  it('provides toggle function', () => {
    const { result } = renderHook(() => useDebugMode());
    expect(typeof result.current.toggle).toBe('function');
  });

  it('toggles enabled state on toggle()', () => {
    const { result } = renderHook(() => useDebugMode());
    expect(result.current.enabled).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.enabled).toBe(false);
  });

  it('setEnabled explicitly sets the state', () => {
    const { result } = renderHook(() => useDebugMode());

    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.enabled).toBe(false);
  });

  it('responds to Ctrl+Shift+D keyboard shortcut', () => {
    const { result } = renderHook(() => useDebugMode());
    expect(result.current.enabled).toBe(false);

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(result.current.enabled).toBe(true);
  });

  it('flags reflect enabled state', () => {
    const { result } = renderHook(() => useDebugMode());

    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.flags.enabled).toBe(true);
  });
});
