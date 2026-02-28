/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Report Schema
 * 
 * Defines report configuration for data aggregation, visualization, and export.
 */

import type { BaseSchema, SchemaNode } from './base';
import type { ChartSchema } from './data-display';
import type { DataSource } from './data';

/**
 * Report Export Format
 */
export type ReportExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'html';

/**
 * Report Schedule Frequency
 */
export type ReportScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Report Aggregation Type
 */
export type ReportAggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct';

/**
 * Report Field Definition
 */
export interface ReportField {
  /**
   * Field name/identifier
   */
  name: string;

  /**
   * Display label
   */
  label?: string;

  /**
   * Field type
   */
  type?: 'string' | 'number' | 'date' | 'boolean';

  /**
   * Aggregation function
   */
  aggregation?: ReportAggregationType;

  /**
   * Format string
   */
  format?: string;

  /**
   * Show in summary
   */
  showInSummary?: boolean;

  /**
   * Sort order
   */
  sortOrder?: number;

  /**
   * Custom render style (e.g., 'badge' for status fields)
   */
  renderAs?: 'badge' | 'text';

  /**
   * Color mapping for badge rendering (value → CSS class or color)
   */
  colorMap?: Record<string, string>;
}

/**
 * Report Filter Definition
 */
export interface ReportFilter {
  /**
   * Field to filter on
   */
  field: string;

  /**
   * Filter operator
   */
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';

  /**
   * Filter value
   */
  value?: any;

  /**
   * Multiple values (for 'in' operator)
   */
  values?: any[];
}

/**
 * Report Group By Definition
 */
export interface ReportGroupBy {
  /**
   * Field to group by
   */
  field: string;

  /**
   * Display label
   */
  label?: string;

  /**
   * Sort direction
   */
  sort?: 'asc' | 'desc';
}

/**
 * Report Section Definition
 */
export interface ReportSection {
  /**
   * Section type
   */
  type: 'header' | 'summary' | 'chart' | 'table' | 'text' | 'page-break';

  /**
   * Section title
   */
  title?: string;

  /**
   * Section content
   */
  content?: SchemaNode | SchemaNode[];

  /**
   * Chart configuration (for type='chart')
   */
  chart?: ChartSchema;

  /**
   * Columns to display (for type='table')
   */
  columns?: ReportField[];

  /**
   * Text content (for type='text')
   */
  text?: string;

  /**
   * Visibility condition
   */
  visible?: boolean | string;
}

/**
 * Report Schedule Configuration
 */
export interface ReportSchedule {
  /**
   * Schedule enabled
   */
  enabled?: boolean;

  /**
   * Frequency
   */
  frequency?: ReportScheduleFrequency;

  /**
   * Specific day of week (for weekly)
   */
  dayOfWeek?: number;

  /**
   * Specific day of month (for monthly)
   */
  dayOfMonth?: number;

  /**
   * Time to run (HH:mm format)
   */
  time?: string;

  /**
   * Timezone
   */
  timezone?: string;

  /**
   * Email recipients
   */
  recipients?: string[];

  /**
   * Email subject
   */
  subject?: string;

  /**
   * Email body
   */
  body?: string;

  /**
   * Export formats to attach
   */
  formats?: ReportExportFormat[];
}

/**
 * Report Export Configuration
 */
export interface ReportExportConfig {
  /**
   * Export format
   */
  format: ReportExportFormat;

  /**
   * Filename template
   */
  filename?: string;

  /**
   * Include headers
   */
  includeHeaders?: boolean;

  /**
   * Page orientation (for PDF)
   */
  orientation?: 'portrait' | 'landscape';

  /**
   * Page size (for PDF)
   */
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';

  /**
   * Custom options
   */
  options?: Record<string, any>;
}

/**
 * Report Type
 * - tabular: flat table
 * - summary: grouped with subtotals
 * - matrix: pivot table
 */
export type ReportType = 'tabular' | 'summary' | 'matrix';

/**
 * Report Schema - Main report configuration
 */
export interface ReportSchema extends BaseSchema {
  type: 'report';

  /**
   * Report title
   */
  title?: string;

  /**
   * Report description
   */
  description?: string;

  /**
   * Report type (tabular, summary, matrix)
   */
  reportType?: ReportType;

  /**
   * Data source configuration
   */
  dataSource?: DataSource;

  /**
   * Report fields
   */
  fields?: ReportField[];

  /**
   * Report filters
   */
  filters?: ReportFilter[];

  /**
   * Group by configuration
   */
  groupBy?: ReportGroupBy[];

  /**
   * Report sections
   */
  sections?: ReportSection[];

  /**
   * Schedule configuration
   */
  schedule?: ReportSchedule;

  /**
   * Default export format
   */
  defaultExportFormat?: ReportExportFormat;

  /**
   * Export configurations
   */
  exportConfigs?: Record<ReportExportFormat, ReportExportConfig>;

  /**
   * Show export buttons
   */
  showExportButtons?: boolean;

  /**
   * Show print button
   */
  showPrintButton?: boolean;

  /**
   * Show schedule button
   */
  showScheduleButton?: boolean;

  /**
   * Auto-refresh interval (in seconds)
   */
  refreshInterval?: number;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Report data
   */
  data?: any[];

  /**
   * Conditional formatting rules
   */
  conditionalFormatting?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
    backgroundColor?: string;
    textColor?: string;
  }>;

  /**
   * Chart configuration (visual chart editor output)
   */
  chartConfig?: {
    chartType?: string;
    xAxisField?: string;
    yAxisFields?: string[];
  };
}

/**
 * Report Builder Schema - Interactive report builder component
 */
export interface ReportBuilderSchema extends BaseSchema {
  type: 'report-builder';

  /**
   * Initial report configuration
   */
  report?: ReportSchema;

  /**
   * Available data sources
   */
  dataSources?: DataSource[];

  /**
   * Available fields
   */
  availableFields?: ReportField[];

  /**
   * Show preview
   */
  showPreview?: boolean;

  /**
   * Save callback
   */
  onSave?: string;

  /**
   * Cancel callback
   */
  onCancel?: string;
}

/**
 * Report Viewer Schema - Display a generated report
 */
export interface ReportViewerSchema extends BaseSchema {
  type: 'report-viewer';

  /**
   * Report to display
   */
  report?: ReportSchema;

  /**
   * Report data
   */
  data?: any[];

  /**
   * Show toolbar
   */
  showToolbar?: boolean;

  /**
   * Allow export
   */
  allowExport?: boolean;

  /**
   * Allow print
   */
  allowPrint?: boolean;

  /**
   * Loading state
   */
  loading?: boolean;
}
