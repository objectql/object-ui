import React from 'react';
import { Input, EmptyValue, cn } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { useLocalization, useDisplayLocale, formatDisplayNumber } from '@object-ui/i18n';
import { resolveFieldCurrency, currencyFractionDigits, currencySymbol } from '../currency.js';
import { useBadInputRefusal, BadInputMessage, BAD_INPUT_BORDER } from './numberBadInput.js';

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

  // Before the readonly return: hooks are unconditional (objectui#6780).
  const { refusal, readBadInput } = useBadInputRefusal('1234.56');

  if (readonly) {
    if (value == null) return <EmptyValue />;
    return (
      <span className="text-sm font-medium tabular-nums">
        {formatAmount(Number(value), currency, precision, locale)}
      </span>
    );
  }

  /**
   * ⚠️ What `e.target.value` can actually hold here — MEASURED in a real
   * browser, not inferred from the spec (objectui#6765).
   *
   * Both edit paths below read the box with a bare `parseFloat` and no
   * whole-string guard of their own. That is deliberate, and it is NOT the
   * objectui#6715 defect wearing a different hat. This is a `type="number"`
   * input, and a real browser never exposes non-numeric residue through
   * `.value`: keystrokes and pastes are filtered before the change event, and
   * the HTML value-sanitization algorithm keeps the value either wholly a
   * valid floating-point number or the empty string.
   *
   * Measured on Chromium 141.0.7390.37 (Playwright 1.62.1), driving THIS
   * widget through the routes a user actually has:
   *
   * ```
   * typed  "12abc" -> box.value "12"    onChange(12)
   * pasted "12abc" -> box.value "12"    onChange(12)
   * typed  "1.2.3" -> box.value "1.23"  onChange(1.23)
   * pasted "0x10"  -> box.value "010"   onChange(10)
   * typed  "1e"    -> box.value ""      onChange(null)   validity.badInput
   * ```
   *
   * ⛔ So objectui#6715's anchored `WHOLE_NUMBER_TEXT` is deliberately NOT
   * copied here. It would accept every string this box can produce and reject
   * only strings the TEST environment fabricates — happy-dom does not
   * implement the sanitization (`input.value = '12abc'` stays `'12abc'`), so a
   * unit test that fires a `change` carrying residue drives a path no browser
   * takes. Adding the guard would buy nothing in the product and would pin a
   * truncation no user reaches. The oracle-vs-product table is pinned in
   * `__tests__/NumberInputWidgets.environmentDivergence.test.tsx`.
   *
   * ⭐ CLOSED for the last row (objectui#6780, ruled 2026-08-29): the silent
   * drop is now ANNOUNCED, through `validity.badInput` — the platform's own
   * predicate — across all four `type="number"` widgets of this package as one
   * change. See `numberBadInput.tsx` for the measurement and for why the
   * emission itself is deliberately unchanged.
   *
   * ⛔ STILL SILENT, and deliberately so: the TRUNCATING rows above. `1.2.3`
   * stores `1.23` and `0x10` stores `10`, and no widget-side guard can refuse
   * them — the browser filtered the keystrokes before `handleChange` ran, so
   * the information is gone before any code here can see it. Only abandoning
   * `type="number"` would recover it, which the same ruling declined (it would
   * reverse objectui#2572's min/max/step and mobile-keyboard affordances).
   * ⚠️ This asymmetry is documented for USERS, not just here — a control that
   * warns about `1e` but silently truncates `1.2.3` teaches people that no
   * warning means the value is right. See `content/docs/guide/fields.md`.
   */
  // Parse and format on blur to ensure valid currency format
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // objectui#6780: the blur arm. React delivers no `onChange` when `.value`
    // never leaves `''` — the measured shape of PASTING `1e` into an empty box
    // — and `badInput` is still true at blur time, so this is the only arm that
    // sees that route.
    //
    // ⚠️ This widget's `onBlur` has ALWAYS overridden the host's (it is written
    // after the `toDomProps` spread), and that is left exactly as it was: no
    // host in this repo passes `onBlur` to a field widget today (the data-table
    // inline editor uses a document-level pointerdown listener instead), so
    // composing it here would be an unmeasured behaviour change outside this
    // card's ruling. Filed separately.
    readBadInput(e.target);
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
    <div className="space-y-1">
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
            // Bare `parseFloat`, deliberately — see the measured note on
            // `handleBlur` above (objectui#6765). The empty string is the
            // browser's ONLY refusal channel on a number input, and it is also
            // how it reports text it is still displaying but cannot read — which
            // is why objectui#6780 asks the browser directly instead, and why the
            // emission below is unchanged by that reading.
            readBadInput(e.target);
            const val = e.target.value === '' ? null : parseFloat(e.target.value);
            onChange(val as any);
          }}
          onBlur={handleBlur}
          placeholder={currencyField?.placeholder || '0.00'}
          disabled={readonly || props.disabled}
          className={cn(symbol ? 'pl-8' : '', refusal ? BAD_INPUT_BORDER : '', className)}
          // Surface the field's declared range (e.g. `min: 0` on a budget) so the
          // browser's spinner/keyboard affordances respect it (objectui#2572);
          // server-side validation still owns enforcement.
          min={typeof currencyField?.min === 'number' ? currencyField.min : undefined}
          max={typeof currencyField?.max === 'number' ? currencyField.max : undefined}
          step={Math.pow(10, -precision).toFixed(precision)}
          // `refusal` is this widget's OWN reading and no host can produce it;
          // `error` keeps its single author (objectui#3222 / objectui#6716).
          aria-invalid={!!error || !!refusal}
        />
      </div>
      <BadInputMessage refusal={refusal} />
    </div>
  );
}
