import { describe, it, expect } from 'vitest';
import { resolveFieldCurrency } from '../index';

describe('resolveFieldCurrency', () => {
  it('prefers the field explicit currency over everything', () => {
    expect(resolveFieldCurrency({ currency: 'JPY', currencyConfig: { defaultCurrency: 'EUR' } }, 'USD')).toBe('JPY');
  });
  it('falls back to currencyConfig.defaultCurrency, then legacy defaultCurrency', () => {
    expect(resolveFieldCurrency({ currencyConfig: { defaultCurrency: 'EUR' } }, 'USD')).toBe('EUR');
    expect(resolveFieldCurrency({ defaultCurrency: 'GBP' } as any, 'USD')).toBe('GBP');
  });
  it('falls back to the tenant default when the field omits its own', () => {
    expect(resolveFieldCurrency({}, 'CNY')).toBe('CNY');
    expect(resolveFieldCurrency(null, 'CNY')).toBe('CNY');
  });
  it('returns undefined when nothing is known (→ renderer shows a plain number)', () => {
    expect(resolveFieldCurrency({})).toBeUndefined();
    expect(resolveFieldCurrency(undefined, undefined)).toBeUndefined();
  });
});
