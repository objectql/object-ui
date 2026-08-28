import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { openNativePicker } from './openNativePicker.js';

/**
 * TimeField - Time picker input widget
 * Uses native time input for hour and minute selection
 */
export function TimeField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<string>) {
  if (readonly) {
    return <span className="text-sm">{value || <EmptyValue />}</span>;
  }

  const domProps = toDomProps(props);

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
