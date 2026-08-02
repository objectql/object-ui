import React from 'react';
import { Textarea, EmptyValue } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/react';
import { FieldWidgetComponentProps } from './types';

/**
 * Rich text field with markdown/HTML support
 * For now, this is a simple textarea. A full implementation would use
 * a rich text editor like TipTap, Lexical, or Slate.
 */
export function RichTextField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetComponentProps<string>) {
  const { t } = useObjectTranslation();
  if (readonly) {
    return (
      <div 
        className="text-sm prose prose-sm max-w-none"
      >
        {value || <EmptyValue />}
      </div>
    );
  }

  const richField = (field || (props as any).schema) as any;
  const rows = richField?.rows || 8;
  const format = richField?.format || 'markdown'; // 'markdown' or 'html'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('fields.richText.format', { format, defaultValue: `Format: ${format}` })}</span>
        <span className="italic">
          {t('fields.richText.basicEditorHint', { defaultValue: 'Rich text editor (basic)' })}
        </span>
      </div>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          richField?.placeholder ||
          t('fields.richText.placeholder', { defaultValue: 'Enter text...' })
        }
        disabled={readonly || props.disabled}
        rows={rows}
        className={`font-mono text-sm ${props.className || ''}`}
        aria-invalid={!!errorMessage}
      />
    </div>
  );
}
