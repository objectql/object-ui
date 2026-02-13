import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * UrlField - URL input with clickable link in readonly mode
 * Validates URLs to only render http/https links for security
 */
export function UrlField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  const config = field || (props as any).schema;
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

  // Filter out non-DOM props
  const { inputType, ...domProps } = props as any;

  return (
    <Input
      {...domProps}
      type="url"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config?.placeholder || 'https://example.com'}
      disabled={readonly || domProps.disabled}
      aria-invalid={!!errorMessage}
    />
  );
}
