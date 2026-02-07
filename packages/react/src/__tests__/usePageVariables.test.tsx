/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  PageVariablesProvider,
  usePageVariables,
  useHasPageVariables,
} from '../hooks/usePageVariables';
import type { PageVariable } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Helper: wrap hook in PageVariablesProvider
// ---------------------------------------------------------------------------

function createWrapper(definitions?: PageVariable[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <PageVariablesProvider definitions={definitions}>
      {children}
    </PageVariablesProvider>
  );
}

// ---------------------------------------------------------------------------
// useHasPageVariables
// ---------------------------------------------------------------------------

describe('useHasPageVariables', () => {
  it('should return false when outside provider', () => {
    const { result } = renderHook(() => useHasPageVariables());
    expect(result.current).toBe(false);
  });

  it('should return true when inside provider', () => {
    const { result } = renderHook(() => useHasPageVariables(), {
      wrapper: createWrapper([]),
    });
    expect(result.current).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// usePageVariables — outside provider (graceful fallback)
// ---------------------------------------------------------------------------

describe('usePageVariables — outside provider', () => {
  it('should return empty variables', () => {
    const { result } = renderHook(() => usePageVariables());
    expect(result.current.variables).toEqual({});
  });

  it('should provide no-op setVariable', () => {
    const { result } = renderHook(() => usePageVariables());
    // Should not throw
    act(() => {
      result.current.setVariable('x', 1);
    });
    expect(result.current.variables).toEqual({});
  });

  it('should provide no-op setVariables', () => {
    const { result } = renderHook(() => usePageVariables());
    act(() => {
      result.current.setVariables({ a: 1, b: 2 });
    });
    expect(result.current.variables).toEqual({});
  });

  it('should provide no-op resetVariables', () => {
    const { result } = renderHook(() => usePageVariables());
    act(() => {
      result.current.resetVariables();
    });
    expect(result.current.variables).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Initialization from definitions
// ---------------------------------------------------------------------------

describe('usePageVariables — initialization', () => {
  it('should initialize string variable with default', () => {
    const defs: PageVariable[] = [
      { name: 'query', type: 'string', defaultValue: 'hello' },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.query).toBe('hello');
  });

  it('should initialize number variable with default', () => {
    const defs: PageVariable[] = [
      { name: 'count', type: 'number', defaultValue: 42 },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.count).toBe(42);
  });

  it('should initialize boolean variable with default', () => {
    const defs: PageVariable[] = [
      { name: 'isOpen', type: 'boolean', defaultValue: true },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.isOpen).toBe(true);
  });

  it('should initialize object variable with default', () => {
    const defs: PageVariable[] = [
      { name: 'filter', type: 'object', defaultValue: { status: 'active' } },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.filter).toEqual({ status: 'active' });
  });

  it('should initialize array variable with default', () => {
    const defs: PageVariable[] = [
      { name: 'tags', type: 'array', defaultValue: ['a', 'b'] },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.tags).toEqual(['a', 'b']);
  });

  it('should use type-appropriate defaults when no defaultValue', () => {
    const defs: PageVariable[] = [
      { name: 'str', type: 'string' },
      { name: 'num', type: 'number' },
      { name: 'bool', type: 'boolean' },
      { name: 'obj', type: 'object' },
      { name: 'arr', type: 'array' },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.str).toBe('');
    expect(result.current.variables.num).toBe(0);
    expect(result.current.variables.bool).toBe(false);
    expect(result.current.variables.obj).toEqual({});
    expect(result.current.variables.arr).toEqual([]);
  });

  it('should default to empty string when type is undefined', () => {
    const defs: PageVariable[] = [{ name: 'unknown' }];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables.unknown).toBe('');
  });

  it('should initialize multiple variables', () => {
    const defs: PageVariable[] = [
      { name: 'name', type: 'string', defaultValue: 'Alice' },
      { name: 'age', type: 'number', defaultValue: 30 },
      { name: 'active', type: 'boolean', defaultValue: true },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });
    expect(result.current.variables).toEqual({
      name: 'Alice',
      age: 30,
      active: true,
    });
  });

  it('should return empty variables when definitions is empty array', () => {
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper([]),
    });
    expect(result.current.variables).toEqual({});
  });

  it('should return empty variables when definitions is undefined', () => {
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(undefined),
    });
    expect(result.current.variables).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// setVariable
// ---------------------------------------------------------------------------

describe('usePageVariables — setVariable', () => {
  it('should update a single variable', () => {
    const defs: PageVariable[] = [
      { name: 'selected', type: 'string', defaultValue: '' },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    act(() => {
      result.current.setVariable('selected', 'item-1');
    });
    expect(result.current.variables.selected).toBe('item-1');
  });

  it('should not overwrite other variables', () => {
    const defs: PageVariable[] = [
      { name: 'a', type: 'string', defaultValue: 'alpha' },
      { name: 'b', type: 'string', defaultValue: 'beta' },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    act(() => {
      result.current.setVariable('a', 'updated');
    });
    expect(result.current.variables.a).toBe('updated');
    expect(result.current.variables.b).toBe('beta');
  });

  it('should allow setting a new key not in definitions', () => {
    const defs: PageVariable[] = [
      { name: 'known', type: 'string', defaultValue: 'x' },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    act(() => {
      result.current.setVariable('dynamic', 'value');
    });
    expect(result.current.variables.dynamic).toBe('value');
    expect(result.current.variables.known).toBe('x');
  });
});

// ---------------------------------------------------------------------------
// setVariables (batch)
// ---------------------------------------------------------------------------

describe('usePageVariables — setVariables', () => {
  it('should update multiple variables at once', () => {
    const defs: PageVariable[] = [
      { name: 'x', type: 'number', defaultValue: 0 },
      { name: 'y', type: 'number', defaultValue: 0 },
      { name: 'z', type: 'number', defaultValue: 0 },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    act(() => {
      result.current.setVariables({ x: 10, y: 20 });
    });
    expect(result.current.variables).toEqual({ x: 10, y: 20, z: 0 });
  });

  it('should merge with existing variables', () => {
    const defs: PageVariable[] = [
      { name: 'name', type: 'string', defaultValue: 'Alice' },
      { name: 'age', type: 'number', defaultValue: 25 },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    act(() => {
      result.current.setVariable('name', 'Bob');
    });
    act(() => {
      result.current.setVariables({ age: 30 });
    });
    expect(result.current.variables).toEqual({ name: 'Bob', age: 30 });
  });
});

// ---------------------------------------------------------------------------
// resetVariables
// ---------------------------------------------------------------------------

describe('usePageVariables — resetVariables', () => {
  it('should reset all variables to defaults', () => {
    const defs: PageVariable[] = [
      { name: 'a', type: 'string', defaultValue: 'original' },
      { name: 'b', type: 'number', defaultValue: 5 },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    // Mutate
    act(() => {
      result.current.setVariables({ a: 'changed', b: 99 });
    });
    expect(result.current.variables).toEqual({ a: 'changed', b: 99 });

    // Reset
    act(() => {
      result.current.resetVariables();
    });
    expect(result.current.variables).toEqual({ a: 'original', b: 5 });
  });

  it('should reset dynamically added variables', () => {
    const defs: PageVariable[] = [
      { name: 'x', type: 'number', defaultValue: 1 },
    ];
    const { result } = renderHook(() => usePageVariables(), {
      wrapper: createWrapper(defs),
    });

    act(() => {
      result.current.setVariable('extra', 'gone');
    });
    expect(result.current.variables.extra).toBe('gone');

    act(() => {
      result.current.resetVariables();
    });
    // 'extra' was not in definitions, so it's removed on reset
    expect(result.current.variables).toEqual({ x: 1 });
  });
});
