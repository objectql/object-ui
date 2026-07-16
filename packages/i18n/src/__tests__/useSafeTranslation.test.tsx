/**
 * Locks the fallback semantics of the safe-translation hooks AFTER the
 * try/catch-around-hook removal (rules-of-hooks, objectui#2595/#2596 class):
 * with no I18nProvider mounted, consumers must still get English defaults —
 * via the testKey probe / per-key detection, not via a caught throw.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createSafeTranslation, useSafeTranslate } from '../useSafeTranslation';

const DEFAULTS = {
  'detail.test': 'Test Anchor',
  'detail.greeting': 'Hello {{name}}',
};

describe('createSafeTranslation (no I18nProvider)', () => {
  it('falls back to defaults with placeholder interpolation', () => {
    const useT = createSafeTranslation(DEFAULTS, 'detail.test');
    const { result } = renderHook(() => useT());
    expect(result.current.t('detail.greeting', { name: 'Ada' })).toBe('Hello Ada');
    expect(result.current.t('detail.test')).toBe('Test Anchor');
    // Unknown keys pass through as-is (historical contract).
    expect(result.current.t('detail.missing')).toBe('detail.missing');
  });

  it('returns a STABLE fallback t across renders (memo-dep friendly)', () => {
    const useT = createSafeTranslation(DEFAULTS, 'detail.test');
    const { result, rerender } = renderHook(() => useT());
    const first = result.current.t;
    rerender();
    expect(result.current.t).toBe(first);
  });
});

describe('useSafeTranslate (no I18nProvider)', () => {
  it('returns the call-site fallback and supports key-chain form', () => {
    const { result } = renderHook(() => useSafeTranslate());
    expect(result.current('common.total', 'Total')).toBe('Total');
    expect(result.current(['common.total', 'dashboard.total'], 'Total')).toBe('Total');
  });
});
