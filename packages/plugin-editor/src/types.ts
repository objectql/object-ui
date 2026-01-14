/**
 * TypeScript type definitions for @object-ui/plugin-editor
 * 
 * These types can be imported by applications using this plugin
 * to get full TypeScript support for code-editor schemas.
 */

import type { BaseSchema } from '@object-ui/types';

/**
 * Code Editor component schema.
 * Renders a Monaco-based code editor with syntax highlighting.
 * 
 * @example
 * ```typescript
 * import type { CodeEditorSchema } from '@object-ui/plugin-editor';
 * 
 * const editorSchema: CodeEditorSchema = {
 *   type: 'code-editor',
 *   value: 'console.log("Hello, World!");',
 *   language: 'javascript',
 *   theme: 'vs-dark',
 *   height: '400px'
 * }
 * ```
 */
export interface CodeEditorSchema extends BaseSchema {
  type: 'code-editor';
  
  /**
   * The code content to display in the editor.
   */
  value?: string;
  
  /**
   * Programming language for syntax highlighting.
   * @default 'javascript'
   */
  language?: 'javascript' | 'typescript' | 'python' | 'json' | 'html' | 'css' | 'markdown' | string;
  
  /**
   * Color theme for the editor.
   * @default 'vs-dark'
   */
  theme?: 'vs-dark' | 'light';
  
  /**
   * Height of the editor.
   * @default '400px'
   */
  height?: string;
  
  /**
   * Whether the editor is read-only.
   * @default false
   */
  readOnly?: boolean;
  
  /**
   * Callback when the code content changes.
   */
  onChange?: (value: string | undefined) => void;
}
