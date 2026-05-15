import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * Format currency value for display. When `currency` is undefined the value
 * is rendered as a plain number with thousands separators (no symbol),
 * because silently assuming USD is misleading for non-USD businesses.
 */
function formatAmount(value: number, currency: string | undefined, precision: number): string {
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(precision)}`;
    }
  }
  try {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  } catch {
    return value.toFixed(precision);
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
};

export function CurrencyField({ value, onChange, field, readonly, errorMessage, className, ...props }: FieldWidgetProps<number>) {
  const currencyField = (field || (props as any).schema) as any;
  const currency: string | undefined = currencyField?.currency;
  const precision = currencyField?.precision ?? 2;

  if (readonly) {
    if (value == null) return <EmptyValue />;
    return (
      <span className="text-sm font-medium tabular-nums">
        {formatAmount(Number(value), currency, precision)}
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
        {...props}
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
        step={Math.pow(10, -precision).toFixed(precision)}
        aria-invalid={!!errorMessage}
      />
    </div>
  );
}
