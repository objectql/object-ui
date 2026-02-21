import React from 'react';
import { Input, Slider } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * PercentField - Percentage input with configurable decimal precision
 * Stores values as decimals (0-1) and displays as percentages (0-100%)
 * Includes a slider for interactive control.
 */
export function PercentField({ value, onChange, field, readonly, errorMessage, className, ...props }: FieldWidgetProps<number>) {
  const percentField = (field || (props as any).schema) as any;
  const precision = percentField?.precision ?? 2;

  if (readonly) {
    if (value == null) return <span className="text-sm">-</span>;
    return (
      <span className="text-sm font-medium tabular-nums">
        {(value * 100).toFixed(precision)}%
      </span>
    );
  }

  // Convert between stored value (0-1) and display value (0-100)
  const displayValue = value != null ? (value * 100) : '';
  const sliderValue = value != null ? value * 100 : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      onChange(null as any);
      return;
    }
    const parsed = parseFloat(e.target.value);
    const val = isNaN(parsed) ? null : parsed / 100;
    onChange(val as any);
  };

  const handleSliderChange = (values: number[]) => {
    onChange(values[0] / 100);
  };

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
        max={100}
        step={1}
        disabled={props.disabled}
        className="w-full"
        data-testid="percent-slider"
      />
    </div>
  );
}
