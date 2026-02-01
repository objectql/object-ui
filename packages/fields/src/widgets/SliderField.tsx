import React from 'react';
import { Slider } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * Slider field widget - provides a range slider input
 * Supports numeric values with configurable min, max, and step
 */
export function SliderField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<number>) {
  // Get slider-specific configuration from field metadata
  const sliderField = (field || (props as any).schema) as any;
  const min = sliderField?.min ?? 0;
  const max = sliderField?.max ?? 100;
  const step = sliderField?.step ?? 1;

  if (readonly) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value ?? min}</span>
        <span className="text-xs text-muted-foreground">/ {max}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Slider
        value={[value ?? min]}
        onValueChange={(values) => onChange(values[0])}
        min={min}
        max={max}
        step={step}
        disabled={readonly}
        className={props.className}
      />
      <span className="text-sm font-medium w-12 text-right">{value ?? min}</span>
    </div>
  );
}
