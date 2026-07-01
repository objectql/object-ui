import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { NumberFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

/**
 * NumberField - Numeric input with optional decimal precision
 * Supports min/max/step constraints and configurable decimal precision
 */
export function NumberField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<number>) {
  if (readonly) {
    return value == null ? <EmptyValue /> : <span className="text-sm">{value}</span>;
  }

  const numberField = (field || (props as any).schema) as NumberFieldMetadata;
  // Step follows `scale` (decimal places), not `precision` (total digit count):
  // a decimal(10, 0) column has 0 decimal places, so the input should step by 1.
  const scale = numberField?.scale;

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === '' ? (null as any) : Number(val));
      }}
      placeholder={numberField?.placeholder}
      disabled={readonly || domProps.disabled}
      step={scale ? Math.pow(10, -scale) : 'any'}
    />
  );
}
