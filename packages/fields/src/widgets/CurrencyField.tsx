import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { useLocalization, useDisplayLocale, formatDisplayNumber } from '@object-ui/i18n';
import { resolveFieldCurrency } from '../currency';

/**
 * Format currency value for display. When `currency` is undefined the value
 * is rendered as a plain number with thousands separators (no symbol),
 * because silently assuming USD is misleading for non-USD businesses.
 */
function formatAmount(
  value: number,
  currency: string | undefined,
  precision: number,
  locale?: string,
): string {
  if (currency) {
    try {
      return formatDisplayNumber(value, {
        locale,
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      });
    } catch {
      return `${currency} ${value.toFixed(precision)}`;
    }
  }
  try {
    // No `scale` passed: this is a currency widget whose `precision` is a
    // display width, so a `precision: 0` amount keeps its separators rather
    // than being read as an ordinal (objectui#4033).
    return formatDisplayNumber(value, {
      locale,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  } catch {
    return value.toFixed(precision);
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
};

export function CurrencyField({ value, onChange, field, readonly, error, className, ...props }: FieldWidgetComponentProps<number>) {
  const currencyField = field as any;
  // Shared precedence: field currency → currencyConfig → tenant default (ADR-0053).
  const { currency: tenantCurrency } = useLocalization();
  const locale = useDisplayLocale();
  const currency: string | undefined = resolveFieldCurrency(currencyField, tenantCurrency);
  const precision = currencyField?.precision ?? 2;

  if (readonly) {
    if (value == null) return <EmptyValue />;
    return (
      <span className="text-sm font-medium tabular-nums">
        {formatAmount(Number(value), currency, precision, locale)}
      </span>
    );
  }

  // Parse and format on blur to ensure valid currency format
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onChange(parseFloat(val.toFixed(precision)));
    }
  };

  const symbol = currency ? (currency === 'USD' ? '$' : currency) : '';

  return (
    <div className="relative">
      {symbol && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          {symbol}
        </span>
      )}
      <Input
        {...toDomProps(props)}
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? null : parseFloat(e.target.value);
          onChange(val as any);
        }}
        onBlur={handleBlur}
        placeholder={currencyField?.placeholder || '0.00'}
        disabled={readonly || props.disabled}
        className={`${symbol ? 'pl-8' : ''} ${className || ''}`}
        // Surface the field's declared range (e.g. `min: 0` on a budget) so the
        // browser's spinner/keyboard affordances respect it (objectui#2572);
        // server-side validation still owns enforcement.
        min={typeof currencyField?.min === 'number' ? currencyField.min : undefined}
        max={typeof currencyField?.max === 'number' ? currencyField.max : undefined}
        step={Math.pow(10, -precision).toFixed(precision)}
        aria-invalid={!!error}
      />
    </div>
  );
}
