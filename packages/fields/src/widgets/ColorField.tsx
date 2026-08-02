import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';

/**
 * Color field widget - provides a color picker input
 * Supports hex color values (e.g., #ff0000)
 */
export function ColorField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<string>) {
  const colorField = (field || (props as any).schema) as any;

  if (readonly) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded border border-input"
          style={{ backgroundColor: value || '#000000' }}
        />
        <span className="text-sm">{value || <EmptyValue />}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly || props.disabled}
        className="w-10 h-10 rounded border border-input cursor-pointer"
      />
      <Input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={colorField?.placeholder || '#000000'}
        disabled={readonly || props.disabled}
        className={props.className}
        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
      />
    </div>
  );
}
