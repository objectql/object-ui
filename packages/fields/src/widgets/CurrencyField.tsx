import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * Format currency value for display
 */
function formatCurrency(value: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function CurrencyField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<number>) {
  const currencyField = (field || (props as any).schema) as any;
  const currency = currencyField?.currency || 'USD';
  const precision = currencyField?.precision ?? 2;

  if (readonly) {
    if (value == null) return <span className="text-sm">-</span>;
    return (
      <span className="text-sm font-medium tabular-nums">
        {formatCurrency(Number(value), currency)}
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

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
        {currency === 'USD' ? '$' : currency}
      </span>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? null : parseFloat(e.target.value);
          onChange(val as any);
        }}
        onBlur={handleBlur}
        placeholder={currencyField?.placeholder || '0.00'}
        disabled={readonly}
        className={`pl-8 ${props.className || ''}`}
        step={Math.pow(10, -precision).toFixed(precision)}
        aria-invalid={!!errorMessage}
        {...props}
      />
    </div>
  );
}
