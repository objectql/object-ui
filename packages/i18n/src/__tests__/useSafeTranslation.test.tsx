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
  // objectui#3418: the same placeholder twice in one sentence — natural in
  // many locales ("已选 {{count}} 项,共 {{count}} 项"), and the shape the
  // fallback used to interpolate only once.
  'detail.selection': 'Selected {{count}} of {{count}} items',
  'detail.pair': '{{a}}/{{b}} — {{a}} again, {{b}} again',
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

  // objectui#3418 — the fallback interpolator must agree with i18next, the
  // engine that serves the *provider* path. Every assertion below was checked
  // against a real i18next instance configured the way `createI18n` configures
  // it (`interpolation: { escapeValue: false }`); the expected strings are
  // i18next's own output, not a guess.
  describe('interpolation matches i18next semantics', () => {
    const useT = createSafeTranslation(DEFAULTS, 'detail.test');

    it('replaces EVERY occurrence of a repeated placeholder', () => {
      const { result } = renderHook(() => useT());
      // Was 'Selected 3 of {{count}} items' while the fallback used
      // `String.prototype.replace` with a string needle (first match only),
      // leaking literal braces to users on provider-less hosts.
      expect(result.current.t('detail.selection', { count: 3 })).toBe(
        'Selected 3 of 3 items',
      );
      // Counts are interpolated as strings elsewhere in this repo too — the
      // `String(v)` coercion must keep serving both spellings identically.
      expect(result.current.t('detail.selection', { count: '3' })).toBe(
        'Selected 3 of 3 items',
      );
    });

    it('replaces every occurrence of each of several repeated placeholders', () => {
      const { result } = renderHook(() => useT());
      expect(result.current.t('detail.pair', { a: 'A', b: 'B' })).toBe(
        'A/B — A again, B again',
      );
    });

    it('still replaces a single occurrence exactly once', () => {
      const { result } = renderHook(() => useT());
      expect(result.current.t('detail.greeting', { name: 'Ada' })).toBe('Hello Ada');
    });

    it('leaves a placeholder literal when no matching option is supplied', () => {
      const { result } = renderHook(() => useT());
      // Unchanged behaviour, pinned so the widened replace scope cannot start
      // inventing empty strings. i18next does the same.
      expect(result.current.t('detail.greeting')).toBe('Hello {{name}}');
      expect(result.current.t('detail.greeting', {})).toBe('Hello {{name}}');
      expect(result.current.t('detail.greeting', { other: 'x' })).toBe('Hello {{name}}');
      expect(result.current.t('detail.selection', { unrelated: 1 })).toBe(
        'Selected {{count}} of {{count}} items',
      );
    });

    it('treats the interpolated value literally, including $-patterns', () => {
      const { result } = renderHook(() => useT());
      // `replace`/`replaceAll` interpret `$&`, `` $` ``, `$'` and `$$` in the
      // *replacement* string; i18next does not, and neither does split/join.
      // A record label carrying one of these is reachable today, unlike the
      // repeated-placeholder case.
      expect(result.current.t('detail.greeting', { name: '$& raw' })).toBe(
        'Hello $& raw',
      );
      expect(result.current.t('detail.greeting', { name: 'a$`b' })).toBe('Hello a$`b');
      expect(result.current.t('detail.selection', { count: '$$' })).toBe(
        'Selected $$ of $$ items',
      );
    });
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
