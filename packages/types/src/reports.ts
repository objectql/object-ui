/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Report Presentation Schema
 *
 * Defines the ObjectUI runtime *presentation* layer for reports:
 * sections, toolbar config, schedule UI, conditional formatting,
 * export presets, etc. These are UX enhancements that the
 * `@objectstack/spec` UI Protocol intentionally does not prescribe.
 *
 * ## Layering
 *
 * - **Protocol / definition:** `./spec-report.ts` re-exports the
 *   authoritative spec `Report` under `SpecReport`. JSON authored
 *   against the spec must work with ObjectUI without rewriting.
 *
 * - **Presentation (this file):** `ReportComponentSchema`, `ReportSection`,
 *   `ReportScheduleConfig`, etc. Drive the legacy `ReportRenderer` /
 *   `ReportViewer` / `ReportBuilder`. Will be gradually thinned as
 *   spec-native renderers take over (see plugin-report roadmap).
 *
 * Use {@link specReportToPresentation} (from `./spec-report`) to
 * convert a spec `Report` into this presentation shape during the
 * migration window.
 */

import type { z } from 'zod';
import type { ReportType as SpecReportType } from '@objectstack/spec/ui';
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
   * Field type — drives type-aware cell rendering.
   *
   * The narrow primitives (string/number/date/boolean) are kept for backwards
   * compatibility, while the broader object-field types (select, multi_select,
   * lookup, reference, email, url, phone, image, richtext, json, datetime,
   * time, percent, currency, file, user, etc.) let the renderer pick the
   * right cell component (Badge for select, link for email/url/phone, ✓/✗
   * for boolean, thumbnail for image, …) instead of falling back to
   * `String(value)`.
   *
   * When the report is bound to an object (`objectName`), the runtime should
   * auto-hydrate this from the corresponding ObjectField so authors don't
   * need to repeat type metadata.
   *
   * `'owner'` was a member until objectui#4814 retired that field-type
   * spelling (ruling A′), carried onto the published twins by objectui#4914.
   * This union is the `.d.ts` half of the contract — while it listed the word,
   * editor autocomplete offered a spelling the renderer refuses with a
   * tombstone. It moves in lockstep with its runtime twin
   * `ReportFieldSchema.type` (`packages/types/src/zod/reports.zod.ts`); the two
   * report faces are never split. Write an owner column as
   * `{ type: 'user', name: 'owner' }`.
   */
  type?:
    | 'string'
    | 'text'
    | 'number'
    | 'date'
    | 'datetime'
    | 'time'
    | 'boolean'
    | 'select'
    | 'multi_select'
    | 'status'
    | 'lookup'
    | 'reference'
    | 'master_detail'
    | 'email'
    | 'url'
    | 'phone'
    | 'currency'
    | 'percent'
    | 'image'
    | 'file'
    | 'user'
    | 'richtext'
    | 'html'
    | 'markdown'
    | 'json'
    | 'tags';

  /**
   * Options for select / multi_select / status types.
   * Used by the cell renderer to resolve raw value → label and badge color.
   */
  options?: Array<{ value: string | number; label: string; color?: string }>;

  /**
   * Target object for lookup / reference / master_detail types.
   * Used by the cell renderer to build a deep-link to the related record.
   */
  referenceTo?: string;

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
   * Custom render style (e.g., 'badge' for status fields).
   * Most types now have sensible default rendering — this is for opt-in
   * overrides only.
   */
  renderAs?: 'badge' | 'text';

  /**
   * Color mapping for badge rendering (value → CSS class or color).
   * Takes precedence over per-option colors when both are provided.
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
export interface ReportScheduleConfig {
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
 * Report Type — derived from `@objectstack/spec`'s `ReportType` enum (issue
 * #2231/#2901; formerly a hand-written union).
 *
 * - `tabular` — flat list, no grouping
 * - `summary` — row-wise grouping with aggregations
 * - `matrix`  — row × column pivot
 * - `joined`  — multiple independent report blocks stacked
 *
 * The mirror was missing `joined`, so a spec-valid joined report did not
 * type-check against `ReportComponentSchema.reportType`. Derived rather than restated so
 * a report format the spec adds cannot go missing here.
 */
export type ReportType = z.infer<typeof SpecReportType>;

/**
 * Report Schema - Main report configuration
 */
export interface ReportComponentSchema extends BaseSchema {
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
  schedule?: ReportScheduleConfig;

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
  report?: ReportComponentSchema;

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
  report?: ReportComponentSchema;

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
