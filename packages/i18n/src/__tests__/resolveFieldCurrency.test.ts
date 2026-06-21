import { describe, it, expect } from 'vitest';
import { resolveFieldCurrency } from '../index';

/**
 * `resolveFieldCurrency` now lives in `@object-ui/i18n` (co-located with
 * `useLocalization`, which supplies the tenant default). `@object-ui/fields`
 * re-exports it; this proves the canonical home resolves the precedence chain.
 */
describe('resolveFieldCurrency (i18n canonical home)', () => {
  it('prefers the field explicit currency over everything', () => {
    expect(
      resolveFieldCurrency({ currency: 'JPY', currencyConfig: { defaultCurrency: 'EUR' } }, 'USD'),
    ).toBe('JPY');
  });

  it('falls back to currencyConfig.defaultCurrency, then legacy defaultCurrency', () => {
    expect(resolveFieldCurrency({ currencyConfig: { defaultCurrency: 'EUR' } }, 'USD')).toBe('EUR');
    expect(resolveFieldCurrency({ defaultCurrency: 'GBP' } as any, 'USD')).toBe('GBP');
  });

  it('falls back to the tenant default when the field omits its own (ADR-0053)', () => {
    expect(resolveFieldCurrency({}, 'CNY')).toBe('CNY');
    expect(resolveFieldCurrency(null, 'CNY')).toBe('CNY');
    expect(resolveFieldCurrency(undefined, 'CNY')).toBe('CNY');
  });

  it('returns undefined when nothing is known (renderer shows a plain number)', () => {
    expect(resolveFieldCurrency({})).toBeUndefined();
    expect(resolveFieldCurrency(undefined, undefined)).toBeUndefined();
  });
});
