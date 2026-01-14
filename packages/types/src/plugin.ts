/**
 * @object-ui/types - Plugin Schema Types
 * 
 * Schema definitions for lazy-loaded plugin components.
 * These types define the interface for heavy components that are loaded on-demand.
 * 
 * @module plugin
 * @packageDocumentation
 */

import { BaseSchema } from './base';

/**
 * Code Editor component schema.
 * Renders a Monaco-based code editor with syntax highlighting.
 * 
 * @example
 * ```typescript
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

/**
 * Bar Chart component schema.
 * Renders a bar chart using Recharts library.
 * 
 * @example
 * ```typescript
 * const chartSchema: BarChartSchema = {
 *   type: 'chart-bar',
 *   data: [
 *     { name: 'Jan', value: 400 },
 *     { name: 'Feb', value: 300 }
 *   ],
 *   dataKey: 'value',
 *   xAxisKey: 'name'
 * }
 * ```
 */
export interface BarChartSchema extends BaseSchema {
  type: 'chart-bar';
  
  /**
   * Array of data points to display in the chart.
   */
  data?: Array<Record<string, any>>;
  
  /**
   * Key in the data object for the Y-axis values.
   * @default 'value'
   */
  dataKey?: string;
  
  /**
   * Key in the data object for the X-axis labels.
   * @default 'name'
   */
  xAxisKey?: string;
  
  /**
   * Height of the chart in pixels.
   * @default 400
   */
  height?: number;
  
  /**
   * Color of the bars.
   * @default '#8884d8'
   */
  color?: string;
}
