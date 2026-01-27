import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function UrlField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    
    // Validate URL to prevent javascript: or data: URLs
    const isValidUrl = value.startsWith('http://') || value.startsWith('https://');
    if (!isValidUrl) {
      return <span className="text-sm">{value}</span>;
    }
    
    return (
      <a 
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        {value}
      </a>
    );
  }

  return (
    <Input
      type="url"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || 'https://example.com'}
      disabled={readonly}
      className={props.className}
      aria-invalid={!!errorMessage}
    />
  );
}
