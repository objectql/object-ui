import React from 'react';
import { Input, Slider, EmptyValue, cn } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { useBadInputRefusal, BadInputMessage, BAD_INPUT_BORDER } from './numberBadInput.js';

/**
 * PercentField - Percentage input with configurable decimal precision
 * Stores values as decimals (0-1) and displays as percentages (0-100%)
 * Includes a slider for interactive control.
 */
export function PercentField({ value, onChange, field, readonly, error, className, ...props }: FieldWidgetComponentProps<number>) {
  const percentField = field as any;
  const precision = percentField?.precision ?? 2;

  // Before the readonly return below: hooks are unconditional (objectui#6780).
  const { refusal, readBadInput } = useBadInputRefusal('12.5');

  // Convention detection. A field declaring `max > 1` (e.g. `max: 100`) stores
  // WHOLE-NUMBER percents (0–100); otherwise values are FRACTIONS (0–1) shown
  // as 0–100%. This matches the read-side formatter so the edit widget agrees
  // with display — and, crucially, keeps the rendered <input> within its `max`
  // (a whole-number 50 must show "50", not "5000", or HTML5 constraint
  // validation marks the field `:invalid` and blocks the whole form's submit).
  const maxAttr = typeof percentField?.max === 'number' ? (percentField.max as number) : undefined;
  const whole = maxAttr != null && maxAttr > 1;
  const toDisplay = (v: number) => (whole ? v : v * 100);
  const fromDisplay = (n: number) => (whole ? n : n / 100);
  const sliderMax = whole ? maxAttr! : 100;

  if (readonly) {
    if (value == null) return <EmptyValue />;
    return (
      <span className="text-sm font-medium tabular-nums">
        {toDisplay(value).toFixed(precision)}%
      </span>
    );
  }

  // Convert between stored value and 0–100 display value
  const displayValue = value != null ? toDisplay(value) : '';
  const sliderValue = value != null ? toDisplay(value) : 0;

  /**
   * ⚠️ What `e.target.value` can actually hold here — MEASURED in a real
   * browser, not inferred from the spec (objectui#6765).
   *
   * The bare `parseFloat` below has no whole-string guard of its own, and that
   * is deliberate rather than objectui#6715's defect repeated. This is a
   * `type="number"` input, and a real browser never exposes non-numeric
   * residue through `.value` — keystrokes and pastes are filtered before the
   * change event fires.
   *
   * Measured on Chromium 141.0.7390.37 (Playwright 1.62.1), driving THIS
   * widget (fraction convention, `precision: 2`):
   *
   * ```
   * typed  "12abc" -> box.value "12"    onChange(0.12)
   * typed  "1.2.3" -> box.value "1.23"  onChange(0.0123)
   * pasted "0x10"  -> box.value "010"   onChange(0.1)
   * typed  "1e"    -> box.value ""      onChange(null)   validity.badInput
   * ```
   *
   * ⛔ objectui#6715's anchored `WHOLE_NUMBER_TEXT` is deliberately NOT copied
   * here: it accepts every string this box can produce and rejects only
   * strings the TEST environment fabricates, because happy-dom does not
   * implement the sanitization. See the fuller note in `CurrencyField.tsx`,
   * and the pinned oracle-vs-product table in
   * `__tests__/NumberInputWidgets.environmentDivergence.test.tsx`.
   *
   * ⭐ CLOSED for the last row (objectui#6780, ruled 2026-08-29): the silent
   * drop is ANNOUNCED, via the platform's own `validity.badInput`, across all
   * four `type="number"` widgets of this package as one change. The measurement
   * and the reason the EMISSION is unchanged live in `numberBadInput.tsx`.
   *
   * ⛔ STILL SILENT, deliberately: the TRUNCATING rows above (`1.2.3` stores
   * `0.0123`, `0x10` stores `0.1`). The browser filtered those keystrokes
   * before this handler ran, so no widget-side guard can refuse them. Written
   * down for users in `content/docs/guide/fields.md`, because a control that
   * warns about `1e` while silently truncating `1.2.3` teaches people that no
   * warning means the value is right.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    readBadInput(e.target);
    if (e.target.value === '') {
      onChange(null as any);
      return;
    }
    const parsed = parseFloat(e.target.value);
    const val = isNaN(parsed) ? null : fromDisplay(parsed);
    onChange(val as any);
  };

  /**
   * The blur arm objectui#6780 adds — this widget had no `onBlur` at all.
   *
   * Needed because React delivers no `onChange` when `.value` never leaves
   * `''`, which is the measured shape of PASTING `1e` into an empty box: one
   * DOM `input` event fires, React's input-value tracking suppresses the
   * synthetic change, and `badInput` is still true at blur time.
   *
   * ⚠️ It COMPOSES the host's `onBlur` instead of replacing it. `onBlur` is a
   * declared DOM pass-through key (`FieldWidgetDomProps`), so `toDomProps`
   * already delivers it here; a bare `onBlur={...}` written after that spread
   * would silently drop a key the contract promises — this package's
   * DECLARED-BUT-NOT-DELIVERED class (objectui#3290 / objectui#3222).
   */
  const domProps = toDomProps(props);
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    readBadInput(e.target);
    domProps.onBlur?.(e);
  };

  const handleSliderChange = (values: number[]) => {
    if (readonly || props.disabled) return;
    if (!Array.isArray(values) || values.length === 0) {
      onChange(null as any);
      return;
    }
    const raw = values[0];
    const nextValue = typeof raw === 'number' ? fromDisplay(raw) : null;
    onChange(nextValue as any);
  };

  // Derive slider step from precision so slider granularity matches the input
  const sliderStep = Math.pow(10, -precision);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          {...domProps}
          type="number"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={percentField?.placeholder || '0'}
          disabled={readonly || props.disabled}
          className={cn('pr-8', refusal ? BAD_INPUT_BORDER : '', className)}
          step={Math.pow(10, -precision).toFixed(precision)}
          // `refusal` is this widget's OWN reading, which no host can produce;
          // `error` keeps its single author (objectui#3222 / objectui#6716).
          aria-invalid={!!error || !!refusal}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          %
        </span>
      </div>
      <BadInputMessage refusal={refusal} />
      <Slider
        value={[sliderValue]}
        onValueChange={handleSliderChange}
        min={0}
        max={sliderMax}
        step={sliderStep}
        disabled={readonly || props.disabled}
        className="w-full"
        aria-label="Percentage"
        data-testid="percent-slider"
      />
    </div>
  );
}
