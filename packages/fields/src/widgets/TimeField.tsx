import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetProps } from './types';
import { openNativePicker } from './openNativePicker';

/**
 * TimeField - Time picker input widget
 * Uses native time input for hour and minute selection
 */
export function TimeField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return <span className="text-sm">{value || <EmptyValue />}</span>;
  }

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="time"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        openNativePicker(e.currentTarget);
        domProps.onClick?.(e);
      }}
      disabled={readonly || domProps.disabled}
    />
  );
}
