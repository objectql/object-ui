import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';

// Export types for external use
export type { CodeEditorSchema } from './types';

// 🚀 Lazy load the implementation file
// This ensures Monaco Editor is only loaded when the component is actually rendered
const LazyMonacoEditor = React.lazy(() => import('./MonacoImpl'));

export interface CodeEditorRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    value?: string;
    language?: string;
    theme?: 'vs-dark' | 'light';
    height?: string;
    readOnly?: boolean;
    onChange?: (value: string | undefined) => void;
  };
  value?: string;
  onChange?: (value: string | undefined) => void;
}

/**
 * CodeEditorRenderer - The public API for the code editor component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const CodeEditorRenderer: React.FC<CodeEditorRendererProps> = ({ schema, value, onChange }) => {
  return (
    <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
      <LazyMonacoEditor
        value={value ?? schema.value}
        language={schema.language}
        theme={schema.theme}
        height={schema.height}
        onChange={onChange ?? schema.onChange}
        readOnly={schema.readOnly}
        className={schema.className}
      />
    </Suspense>
  );
};

// Register the component with the ComponentRegistry
ComponentRegistry.register(
  'code-editor',
  CodeEditorRenderer,
  {
    label: 'Code Editor',
    category: 'plugin',
    inputs: [
      { name: 'value', type: 'string', label: 'Code', defaultValue: '' },
      { name: 'language', type: 'enum', label: 'Language', enum: ['javascript', 'typescript', 'python', 'json', 'html', 'css'], defaultValue: 'javascript' },
      { name: 'theme', type: 'enum', label: 'Theme', enum: ['vs-dark', 'light'], defaultValue: 'vs-dark' },
      { name: 'height', type: 'string', label: 'Height', defaultValue: '400px' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
    defaultProps: {
      value: '// Write your code here\nconsole.log("Hello, World!");',
      language: 'javascript',
      theme: 'vs-dark',
      height: '400px',
      readOnly: false,
    },
  }
);

// Standard Export Protocol - for manual integration
export const editorComponents = {
  'code-editor': CodeEditorRenderer,
};
