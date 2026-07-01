import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { LocalizationProvider } from '@object-ui/i18n';
import { useColumnSummary } from './useColumnSummary';

/**
 * Grid footer summaries (useColumnSummary) must agree with the cells above
 * them: a `currency` column that declares no explicit code now resolves the
 * tenant default (localization.currency, ADR-0053) through the shared
 * resolveFieldCurrency, instead of degrading to a bare number.
 */
const COLUMNS: any[] = [{ field: 'amount', summary: 'sum', type: 'currency' }];
const DATA = [{ amount: 1000 }, { amount: 234 }];

function wrapper(currency?: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <LocalizationProvider value={{ currency }}>{children}</LocalizationProvider>
  );
}

describe('useColumnSummary tenant-default currency', () => {
  it('formats a currency column with the tenant default when the column omits a code', () => {
    const { result } = renderHook(() => useColumnSummary(COLUMNS, DATA), {
      wrapper: wrapper('CNY'),
    });
    const label = result.current.summaries.get('amount')?.label ?? '';
    // 1234 in CNY → a yen/yuan symbol, never a bare number.
    expect(label).toMatch(/Sum:/);
    expect(label).toMatch(/[¥]|CN¥|CNY/);
    expect(label).toMatch(/1,234/);
  });

  it('falls back to a plain number when no tenant currency is configured', () => {
    const { result } = renderHook(() => useColumnSummary(COLUMNS, DATA), {
      wrapper: wrapper(undefined),
    });
    const label = result.current.summaries.get('amount')?.label ?? '';
    expect(label).toMatch(/Sum: /);
    expect(label).not.toMatch(/[¥$€£]/);
    expect(label).toMatch(/1,234/);
  });

  it('still prefers an explicit column currency over the tenant default', () => {
    const cols: any[] = [{ field: 'amount', summary: 'sum', type: 'currency', currency: 'USD' }];
    const { result } = renderHook(() => useColumnSummary(cols, DATA), {
      wrapper: wrapper('CNY'),
    });
    const label = result.current.summaries.get('amount')?.label ?? '';
    expect(label).toMatch(/\$|US\$/);
  });

  // Regression (#2134): `precision` is the total digit count of a decimal(p, s)
  // column, NOT the decimal places. It must not drive fraction digits, or a
  // decimal(10, 0) sum renders as "…0000000000".
  it('does not pad a currency sum using precision (total digits)', () => {
    const cols: any[] = [{ field: 'amount', summary: 'sum', type: 'currency', currency: 'USD', precision: 10, scale: 0 }];
    const { result } = renderHook(() => useColumnSummary(cols, [{ amount: 1000 }, { amount: 234 }]), {
      wrapper: wrapper('USD'),
    });
    const label = result.current.summaries.get('amount')?.label ?? '';
    expect(label).not.toMatch(/\.0{3,}/);
    expect(label).toMatch(/1,234/);
  });

  it('honours a currency column scale for fraction digits', () => {
    const cols: any[] = [{ field: 'amount', summary: 'sum', type: 'currency', currency: 'USD', precision: 12, scale: 2 }];
    const { result } = renderHook(() => useColumnSummary(cols, [{ amount: 1000 }, { amount: 234 }]), {
      wrapper: wrapper('USD'),
    });
    const label = result.current.summaries.get('amount')?.label ?? '';
    expect(label).toMatch(/1,234\.00/);
  });
});
