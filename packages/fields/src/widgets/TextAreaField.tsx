import React from 'react';
import { Textarea } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function TextAreaField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return (
      <div className="text-sm whitespace-pre-wrap">
        {value || '-'}
      </div>
    );
  }

  const textareaField = field as any;
  const rows = textareaField.rows || 4;
  const maxLength = textareaField.max_length;

  return (
    <div className="relative">
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={readonly}
        rows={rows}
        maxLength={maxLength}
        className={props.className}
        aria-invalid={!!errorMessage}
      />
      {maxLength && (
        <div 
          className="absolute bottom-2 right-2 text-xs text-gray-400"
          aria-live="polite"
          aria-label={`Character count: ${(value || '').length} of ${maxLength}`}
        >
          {(value || '').length}/{maxLength}
        </div>
      )}
    </div>
  );
}
