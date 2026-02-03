import React from 'react';
import { Input } from '@object-ui/components';
import { NumberFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

export function NumberField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<number>) {
  if (readonly) {
    return <span className="text-sm">{value ?? '-'}</span>;
  }

  const numberField = (field || (props as any).schema) as NumberFieldMetadata;
  const precision = numberField?.precision;

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
      step={precision ? Math.pow(10, -precision) : 'any'}
    />
  );
}
