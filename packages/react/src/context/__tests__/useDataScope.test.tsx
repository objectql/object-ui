/**
 * Tests for useDataScope hook — verifies correct scoping behavior.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { SchemaRendererProvider, useDataScope } from '../SchemaRendererContext';

describe('useDataScope', () => {
  it('returns undefined when no path is provided', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SchemaRendererProvider dataSource={{ users: [1, 2, 3] }}>
        {children}
      </SchemaRendererProvider>
    );

    const { result } = renderHook(() => useDataScope(undefined), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('returns undefined when path is empty string', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SchemaRendererProvider dataSource={{ users: [1, 2, 3] }}>
        {children}
      </SchemaRendererProvider>
    );

    const { result } = renderHook(() => useDataScope(''), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('returns scoped data when a valid path is given', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SchemaRendererProvider dataSource={{ users: [{ name: 'Alice' }] }}>
        {children}
      </SchemaRendererProvider>
    );

    const { result } = renderHook(() => useDataScope('users'), { wrapper });

    expect(result.current).toEqual([{ name: 'Alice' }]);
  });

  it('resolves nested paths', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SchemaRendererProvider dataSource={{ app: { settings: { theme: 'dark' } } }}>
        {children}
      </SchemaRendererProvider>
    );

    const { result } = renderHook(() => useDataScope('app.settings.theme'), { wrapper });

    expect(result.current).toBe('dark');
  });

  it('returns undefined for non-existent path', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SchemaRendererProvider dataSource={{ users: [] }}>
        {children}
      </SchemaRendererProvider>
    );

    const { result } = renderHook(() => useDataScope('nonexistent'), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('returns undefined when no SchemaRendererProvider is present', () => {
    const { result } = renderHook(() => useDataScope('users'));

    expect(result.current).toBeUndefined();
  });

  it('does not return the adapter/service object when no path is given', () => {
    // Simulate the real scenario: dataSource is a service adapter with methods
    const adapter = { find: () => {}, create: () => {}, update: () => {} };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SchemaRendererProvider dataSource={adapter}>
        {children}
      </SchemaRendererProvider>
    );

    const { result } = renderHook(() => useDataScope(undefined), { wrapper });

    // Should NOT return the adapter — that would prevent ObjectChart from fetching
    expect(result.current).toBeUndefined();
  });
});
