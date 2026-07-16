/**
 * Tests for useExpression and useCondition hooks
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { useExpression, useCondition, useRowPredicate, PredicateScopeProvider } from '../useExpression';

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

  describe('{ throwOnError: true } — fail-closed opt-in (mirrors ActionEngine)', () => {
    // A bare reference to an undeclared identifier — not merely a property
    // access on an existing object — genuinely throws a ReferenceError from
    // the compiled expression, the same shape of failure ActionEngine's own
    // fail-closed regression test uses (a predicate referencing missing context).
    const THROWING = '${nonexistentIdentifier.field}';

    it('defaults to fail-OPEN (true) on a throwing predicate when not requested', () => {
      const { result } = renderHook(() => useCondition(THROWING, { data: {} }));
      expect(result.current).toBe(true);
    });

    it('fails CLOSED (false) on a throwing predicate when requested', () => {
      const { result } = renderHook(() =>
        useCondition(THROWING, { data: {} }, { throwOnError: true }),
      );
      expect(result.current).toBe(false);
    });

    it('still evaluates normally (no change) when the predicate does not throw', () => {
      const context = { data: { status: 'active' } };
      const { result } = renderHook(() =>
        useCondition('${data.status === "active"}', context, { throwOnError: true }),
      );
      expect(result.current).toBe(true);
    });

    it('warns ONCE with the label when a fail-closed predicate throws (#2358)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const SRC = '${undeclaredWarnProbe2358.field}';
        const { unmount } = renderHook(() =>
          useCondition(SRC, { data: {} }, { throwOnError: true, label: 'action "probe_2358" (visible)' }),
        );
        const matching = () =>
          warn.mock.calls.filter(c => String(c[0]).includes('probe_2358'));
        expect(matching()).toHaveLength(1);
        expect(String(matching()[0][0])).toMatch(/hidden\/disabled/);
        expect(String(matching()[0][0])).toContain(SRC);
        // Remount with the same predicate → deduped, no second warning.
        unmount();
        renderHook(() =>
          useCondition(SRC, { data: {} }, { throwOnError: true, label: 'action "probe_2358" (visible)' }),
        );
        expect(matching()).toHaveLength(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});

describe('useRowPredicate (canonical CEL row predicate — issue #1584)', () => {
  it('returns a boolean predicate as-is (short-circuit)', () => {
    expect(renderHook(() => useRowPredicate(true, { a: 1 })).result.current).toBe(true);
    expect(renderHook(() => useRowPredicate(false, { a: 1 })).result.current).toBe(false);
  });

  it('returns the fallback for an absent predicate (default true)', () => {
    expect(renderHook(() => useRowPredicate(undefined, { a: 1 })).result.current).toBe(true);
    expect(renderHook(() => useRowPredicate('', { a: 1 })).result.current).toBe(true);
    expect(renderHook(() => useRowPredicate(undefined, { a: 1 }, { fallback: false })).result.current).toBe(false);
  });

  it('evaluates a CEL predicate over the row (record.* and bare)', () => {
    expect(renderHook(() => useRowPredicate("record.status == 'active'", { status: 'active' })).result.current).toBe(true);
    expect(renderHook(() => useRowPredicate("status == 'active'", { status: 'closed' })).result.current).toBe(false);
  });

  it('supports the CEL `in` operator (legacy engine could not)', () => {
    expect(renderHook(() => useRowPredicate("record.role in ['admin', 'owner']", { role: 'owner' })).result.current).toBe(true);
    expect(renderHook(() => useRowPredicate("record.role in ['admin', 'owner']", { role: 'member' })).result.current).toBe(false);
  });

  it('merges the ambient predicate scope (features/user)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(PredicateScopeProvider, { scope: { features: { canEdit: true } } }, children);
    expect(
      renderHook(() => useRowPredicate('features.canEdit == true', { id: '1' }), { wrapper }).result.current,
    ).toBe(true);
  });

  it('fails CLOSED and warns on a broken predicate when warnOnError is set', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useRowPredicate('record.status ==', { status: 'x' }, { fallback: false, warnOnError: true, label: 'resume' }),
    );
    expect(result.current).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
