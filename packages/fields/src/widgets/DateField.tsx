import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetProps } from './types';
import { openNativePicker } from './openNativePicker';

/**
 * DateField - Date picker input widget
 * Uses native date input and displays locale-formatted date in readonly mode
 */
export function DateField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return value ? <span className="text-sm">{new Date(value).toLocaleDateString()}</span> : <EmptyValue />;
  }

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="date"
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
