import React from 'react';
import { Input } from '@object-ui/components';
import { NumberFieldMetadata } from '@object-ui/types';
import { FieldWidgetProps } from './types';

export function NumberField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<number>) {
  if (readonly) {
    return <span className="text-sm">{value ?? '-'}</span>;
  }

  const precision = (field as unknown as NumberFieldMetadata).precision;

  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === '' ? (null as any) : Number(val));
      }}
      placeholder={field.placeholder}
      disabled={readonly}
      step={precision ? Math.pow(10, -precision) : 'any'}
      className={props.className}
    />
  );
}
