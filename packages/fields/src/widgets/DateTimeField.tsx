import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function DateTimeField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    const date = new Date(value);
    return (
      <span className="text-sm">
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </span>
    );
  }

  return (
    <Input
      {...props}
      type="datetime-local"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readonly}
    />
  );
}
