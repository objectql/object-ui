import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { useLocalization, useDisplayLocale, formatDisplayNumber } from '@object-ui/i18n';
import { resolveFieldCurrency, currencyFractionDigits, currencySymbol } from '../currency';

/**
 * Format currency value for display. When `currency` is undefined the value
 * is rendered as a plain number with thousands separators (no symbol),
 * because silently assuming USD is misleading for non-USD businesses.
 *
 * `precision` is a display width the caller resolved — either the field's
 * authored `precision` or, when it declared none, the currency's own ISO 4217
 * minor-unit count (see the derivation at the call site, objectui#4361).
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

export function CurrencyField({ value, onChange, field, readonly, error, className, ...props }: FieldWidgetComponentProps<number>) {
  const currencyField = field as any;
  // Shared precedence: field currency → currencyConfig → tenant default (ADR-0053).
  const { currency: tenantCurrency } = useLocalization();
  const locale = useDisplayLocale();
  const currency: string | undefined = resolveFieldCurrency(currencyField, tenantCurrency);
  // An AUTHORED `precision` wins: it is authored metadata, and this repo's
  // convention is that authored metadata keeps priority. Whether a declared
  // `precision` that contradicts the currency's ISO 4217 digits (say
  // `precision: 2` on a JPY field) should be REJECTED at publish time is a
  // contract question, so it is filed upstream in `@objectstack/spec` rather
  // than answered here by overriding the author (objectui#4361).
  //
  // An ABSENT `precision` derives from the currency instead of defaulting to a
  // literal 2, which rendered `¥1,234.50` for a currency with no minor unit.
  // "Absent" is genuinely distinguishable from "authored 2" here — MEASURED,
  // not assumed: `CurrencyFieldMetadata.precision` is optional in
  // `@object-ui/types` and `z.ZodOptional<z.ZodNumber>` (no `.default()`) in
  // `@objectstack/spec`, so a parsed field carries no materialized 2. The only
  // `.default(2)` on the currency surface is `CurrencyConfigSchema.precision`,
  // a different key on the `currencyConfig` block that this widget never reads.
  //
  // This is the widget's ONE precision, so the derivation also reaches the edit
  // affordances below. Deliberate: leaving `step`/blur-rounding at 2 would give
  // a JPY field that displays whole yen while offering a 0.01 spinner step and
  // rounding typed input to 1234.56 yen.
  const precision =
    currencyField?.precision ?? (currency ? currencyFractionDigits(currency) : 2);

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

  // ONE channel for the symbol (objectui#4414). This used to be a hand-written
  // `currency === 'USD' ? '$' : currency` ternary, with a dead one-entry
  // `CURRENCY_SYMBOLS` map sitting two lines above it restating the same fact —
  // a table that looked like the place to add a currency but that nothing read.
  // Both were hand copies of knowledge `Intl` already carries, and both are
  // gone: `currencySymbol` reads the `currency` part of the SAME format the
  // readonly branch above renders amounts with, so the two modes of this widget
  // can no longer disagree (they did: `JPY` in the adornment, `¥1,235` in the
  // readonly span). USD at the display-locale default is `$` either way.
  const symbol = currency ? currencySymbol(currency, locale) : '';

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
