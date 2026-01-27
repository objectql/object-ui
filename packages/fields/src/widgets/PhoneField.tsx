import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function PhoneField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    return (
      <a 
        href={`tel:${value}`}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        {value}
      </a>
    );
  }

  return (
    <Input
      type="tel"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || '(555) 123-4567'}
      disabled={readonly}
      className={props.className}
      aria-invalid={!!errorMessage}
    />
  );
}
