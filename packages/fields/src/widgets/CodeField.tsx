import React from 'react';
import { Textarea } from '@object-ui/components';
import { FieldWidgetProps } from './types';

/**
 * Code field widget - provides a code editor with syntax highlighting
 * Uses a simple textarea with monospace font
 * For advanced code editing, use the @object-ui/plugin-editor component
 */
export function CodeField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const config = field || (props as any).schema;
  // Get code-specific configuration from field metadata
  const language = (config as any)?.language ?? 'javascript';

  if (readonly) {
    return (
      <pre className="text-sm bg-muted p-2 rounded overflow-x-auto border">
        <code>{value || '-'}</code>
      </pre>
    );
  }

  return (
    <Textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config?.placeholder || `// Write ${language} code here...`}
      disabled={readonly}
      className={`font-mono text-sm ${props.className}`}
      rows={12}
      spellCheck={false}
    />
  );
}
