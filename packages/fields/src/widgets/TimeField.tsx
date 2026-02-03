import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function TimeField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return <span className="text-sm">{value || '-'}</span>;
  }

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="time"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readonly || domProps.disabled}
    />
  );
}
