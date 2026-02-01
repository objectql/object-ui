import React from 'react';
import { Textarea } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * ObjectField - JSON object editor
 * Allows editing structured JSON data
 */
export function ObjectField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  const config = field || (props as any).schema;
  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    return (
      <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-auto max-h-40">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  // Convert object to JSON string for editing
  const jsonString = value ? JSON.stringify(value, null, 2) : '';

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const str = e.target.value;
    if (!str.trim()) {
      onChange(null);
      return;
    }
    
    try {
      const parsed = JSON.parse(str);
      onChange(parsed);
    } catch {
      // Invalid JSON - keep the current valid value, don't update
      // User will need to fix JSON before it's saved
    }
  };

  return (
    <Textarea
      value={jsonString}
      onChange={handleChange}
      placeholder={config?.placeholder || '{\n  "key": "value"\n}'}
      disabled={readonly}
      className={`font-mono text-xs ${props.className || ''}`}
      rows={6}
    />
  );
}
