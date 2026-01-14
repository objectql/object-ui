/**
 * TypeScript type definitions for @object-ui/plugin-charts
 * 
 * These types can be imported by applications using this plugin
 * to get full TypeScript support for chart schemas.
 */

import type { BaseSchema } from '@object-ui/types';

/**
 * Bar Chart component schema.
 * Renders a bar chart using Recharts library.
 * 
 * @example
 * ```typescript
 * import type { BarChartSchema } from '@object-ui/plugin-charts';
 * 
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
