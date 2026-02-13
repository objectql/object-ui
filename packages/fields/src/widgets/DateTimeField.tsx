import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * DateTimeField - Combined date and time picker widget
 * Displays both date and time in locale format when readonly
 */
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

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="datetime-local"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readonly || domProps.disabled}
    />
  );
}
