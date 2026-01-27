import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function EmailField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    return (
      <a 
        href={`mailto:${value}`}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        {value}
      </a>
    );
  }

  return (
    <Input
      type="email"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || 'email@example.com'}
      disabled={readonly}
      className={props.className}
      aria-invalid={!!errorMessage}
    />
  );
}
