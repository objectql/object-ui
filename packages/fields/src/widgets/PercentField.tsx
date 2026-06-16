import React from 'react';
import { Input, Slider, EmptyValue } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * PercentField - Percentage input with configurable decimal precision
 * Stores values as decimals (0-1) and displays as percentages (0-100%)
 * Includes a slider for interactive control.
 */
export function PercentField({ value, onChange, field, readonly, errorMessage, className, ...props }: FieldWidgetProps<number>) {
  const percentField = (field || (props as any).schema) as any;
  const precision = percentField?.precision ?? 2;

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      onChange(null as any);
      return;
    }
    const parsed = parseFloat(e.target.value);
    const val = isNaN(parsed) ? null : fromDisplay(parsed);
    onChange(val as any);
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
          {...props}
          type="number"
          value={displayValue}
          onChange={handleChange}
          placeholder={percentField?.placeholder || '0'}
          disabled={readonly || props.disabled}
          className={`pr-8 ${className || ''}`}
          step={Math.pow(10, -precision).toFixed(precision)}
          aria-invalid={!!errorMessage}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          %
        </span>
      </div>
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
