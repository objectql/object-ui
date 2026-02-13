import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * EmailField - Email address input with mailto link in readonly mode
 * Renders as a clickable mailto link when readonly, standard email input otherwise
 */
export function EmailField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  const config = field || (props as any).schema;
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

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="email"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config?.placeholder || 'email@example.com'}
      disabled={readonly || domProps.disabled}
      aria-invalid={!!errorMessage}
    />
  );
}
