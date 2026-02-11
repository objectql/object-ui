/**
 * Tests for useExpression and useCondition hooks
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExpression, useCondition } from '../useExpression';

describe('useExpression', () => {
  it('returns string value directly for non-expression strings', () => {
    const { result } = renderHook(() => useExpression('hello'));

    expect(result.current).toBe('hello');
  });

  it('returns number value directly', () => {
    const { result } = renderHook(() => useExpression(42));

    expect(result.current).toBe(42);
  });

  it('returns boolean value directly', () => {
    const { result } = renderHook(() => useExpression(true));

    expect(result.current).toBe(true);
  });

  it('returns null for null expressions', () => {
    const { result } = renderHook(() => useExpression(null));

    expect(result.current).toBeNull();
  });

  it('returns undefined for undefined expressions', () => {
    const { result } = renderHook(() => useExpression(undefined));

    expect(result.current).toBeUndefined();
  });

  it('evaluates expressions with ${...} syntax', () => {
    const context = { data: { name: 'John' } };
    const { result } = renderHook(() =>
      useExpression('${data.name}', context),
    );

    expect(result.current).toBe('John');
  });

  it('evaluates expressions with context data', () => {
    const context = { data: { age: 25 } };
    const { result } = renderHook(() =>
      useExpression('${data.age > 18}', context),
    );

    expect(result.current).toBe(true);
  });
});

describe('useCondition', () => {
  it('returns true for boolean true', () => {
    const { result } = renderHook(() => useCondition(true));

    expect(result.current).toBe(true);
  });

  it('returns false for boolean false', () => {
    const { result } = renderHook(() => useCondition(false));

    expect(result.current).toBe(false);
  });

  it('returns true for undefined', () => {
    const { result } = renderHook(() => useCondition(undefined));

    expect(result.current).toBe(true);
  });

  it('evaluates string conditions with context', () => {
    const context = { data: { status: 'active' } };
    const { result } = renderHook(() =>
      useCondition('${data.status === "active"}', context),
    );

    expect(result.current).toBe(true);
  });
});
