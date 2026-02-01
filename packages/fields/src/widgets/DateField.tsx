import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function DateField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return <span className="text-sm">{value ? new Date(value).toLocaleDateString() : '-'}</span>;
  }

  return (
    <Input
      {...props}
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readonly}
    />
  );
}
