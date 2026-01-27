import React from 'react';
import { Textarea } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * Rich text field with markdown/HTML support
 * For now, this is a simple textarea. A full implementation would use
 * a rich text editor like TipTap, Lexical, or Slate.
 */
export function RichTextField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  if (readonly) {
    return (
      <div 
        className="text-sm prose prose-sm max-w-none"
      >
        {value || '-'}
      </div>
    );
  }

  const richField = field as any;
  const rows = richField.rows || 8;
  const format = richField.format || 'markdown'; // 'markdown' or 'html'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Format: {format}</span>
        <span className="italic">Rich text editor (basic)</span>
      </div>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || 'Enter text...'}
        disabled={readonly}
        rows={rows}
        className={`font-mono text-sm ${props.className || ''}`}
        aria-invalid={!!errorMessage}
      />
    </div>
  );
}
