/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Report Schema Zod Validators
 * 
 * Zod validation schemas for report configuration.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/reports
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';
import { ChartSchema } from './data-display.zod.js';

/**
 * Report Export Format Schema
 */
export const ReportExportFormatSchema = z.enum(['pdf', 'excel', 'csv', 'json', 'html']).describe('Report export format');

/**
 * Report Schedule Frequency Schema
 */
export const ReportScheduleFrequencySchema = z.enum(['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']).describe('Report schedule frequency');

/**
 * Report Aggregation Type Schema
 */
export const ReportAggregationTypeSchema = z.enum(['sum', 'avg', 'min', 'max', 'count', 'distinct']).describe('Report aggregation type');

/**
 * Report Field Schema
 */
export const ReportFieldSchema = z.object({
  name: z.string().describe('Field name/identifier'),
  label: z.string().optional().describe('Display label'),
  type: z.enum(['string', 'number', 'date', 'boolean']).optional().describe('Field type'),
  aggregation: ReportAggregationTypeSchema.optional().describe('Aggregation function'),
  format: z.string().optional().describe('Format string'),
  showInSummary: z.boolean().optional().describe('Show in summary'),
  sortOrder: z.number().optional().describe('Sort order'),
});

/**
 * Report Filter Schema
 */
export const ReportFilterSchema = z.object({
  field: z.string().describe('Field to filter on'),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'between', 'in', 'not_in']).describe('Filter operator'),
  value: z.any().optional().describe('Filter value'),
  values: z.array(z.any()).optional().describe('Multiple values (for "in" operator)'),
});

/**
 * Report Group By Schema
 */
export const ReportGroupBySchema = z.object({
  field: z.string().describe('Field to group by'),
  label: z.string().optional().describe('Display label'),
  sort: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
});

/**
 * Report Section Schema
 */
export const ReportSectionSchema = z.object({
  type: z.enum(['header', 'summary', 'chart', 'table', 'text', 'page-break']).describe('Section type'),
  title: z.string().optional().describe('Section title'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Section content'),
  chart: ChartSchema.optional().describe('Chart configuration (for type="chart")'),
  columns: z.array(ReportFieldSchema).optional().describe('Columns to display (for type="table")'),
  text: z.string().optional().describe('Text content (for type="text")'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Visibility condition'),
});

/**
 * Report Schedule Schema
 */
export const ReportScheduleSchema = z.object({
  enabled: z.boolean().optional().describe('Schedule enabled'),
  frequency: ReportScheduleFrequencySchema.optional().describe('Frequency'),
  dayOfWeek: z.number().optional().describe('Specific day of week (for weekly)'),
  dayOfMonth: z.number().optional().describe('Specific day of month (for monthly)'),
  time: z.string().optional().describe('Time to run (HH:mm format)'),
  timezone: z.string().optional().describe('Timezone'),
  recipients: z.array(z.string()).optional().describe('Email recipients'),
  subject: z.string().optional().describe('Email subject'),
  body: z.string().optional().describe('Email body'),
  formats: z.array(ReportExportFormatSchema).optional().describe('Export formats to attach'),
});

/**
 * Report Export Config Schema
 */
export const ReportExportConfigSchema = z.object({
  format: ReportExportFormatSchema.describe('Export format'),
  filename: z.string().optional().describe('Filename template'),
  includeHeaders: z.boolean().optional().describe('Include headers'),
  orientation: z.enum(['portrait', 'landscape']).optional().describe('Page orientation (for PDF)'),
  pageSize: z.enum(['A4', 'A3', 'Letter', 'Legal']).optional().describe('Page size (for PDF)'),
  options: z.record(z.string(), z.any()).optional().describe('Custom options'),
});

/**
 * Report Schema
 */
export const ReportSchema = BaseSchema.extend({
  type: z.literal('report'),
  title: z.string().optional().describe('Report title'),
  description: z.string().optional().describe('Report description'),
  dataSource: z.any().optional().describe('Data source configuration'),
  fields: z.array(ReportFieldSchema).optional().describe('Report fields'),
  filters: z.array(ReportFilterSchema).optional().describe('Report filters'),
  groupBy: z.array(ReportGroupBySchema).optional().describe('Group by configuration'),
  sections: z.array(ReportSectionSchema).optional().describe('Report sections'),
  schedule: ReportScheduleSchema.optional().describe('Schedule configuration'),
  defaultExportFormat: ReportExportFormatSchema.optional().describe('Default export format'),
  exportConfigs: z.record(z.string(), ReportExportConfigSchema).optional().describe('Export configurations'),
  showExportButtons: z.boolean().optional().describe('Show export buttons'),
  showPrintButton: z.boolean().optional().describe('Show print button'),
  showScheduleButton: z.boolean().optional().describe('Show schedule button'),
  refreshInterval: z.number().optional().describe('Auto-refresh interval (in seconds)'),
  loading: z.boolean().optional().describe('Loading state'),
  data: z.array(z.any()).optional().describe('Report data'),
});

/**
 * Report Builder Schema
 */
export const ReportBuilderSchema = BaseSchema.extend({
  type: z.literal('report-builder'),
  report: ReportSchema.optional().describe('Initial report configuration'),
  dataSources: z.array(z.any()).optional().describe('Available data sources'),
  availableFields: z.array(ReportFieldSchema).optional().describe('Available fields'),
  showPreview: z.boolean().optional().describe('Show preview'),
  onSave: z.string().optional().describe('Save callback'),
  onCancel: z.string().optional().describe('Cancel callback'),
});

/**
 * Report Viewer Schema
 */
export const ReportViewerSchema = BaseSchema.extend({
  type: z.literal('report-viewer'),
  report: ReportSchema.optional().describe('Report to display'),
  data: z.array(z.any()).optional().describe('Report data'),
  showToolbar: z.boolean().optional().describe('Show toolbar'),
  allowExport: z.boolean().optional().describe('Allow export'),
  allowPrint: z.boolean().optional().describe('Allow print'),
  loading: z.boolean().optional().describe('Loading state'),
});

/**
 * Union of all report schemas
 */
export const ReportComponentSchema = z.discriminatedUnion('type', [
  ReportSchema,
  ReportBuilderSchema,
  ReportViewerSchema,
]);

/**
 * Export type inference helpers
 */
export type ReportExportFormatSchemaType = z.infer<typeof ReportExportFormatSchema>;
export type ReportScheduleFrequencySchemaType = z.infer<typeof ReportScheduleFrequencySchema>;
export type ReportAggregationTypeSchemaType = z.infer<typeof ReportAggregationTypeSchema>;
export type ReportFieldSchemaType = z.infer<typeof ReportFieldSchema>;
export type ReportFilterSchemaType = z.infer<typeof ReportFilterSchema>;
export type ReportGroupBySchemaType = z.infer<typeof ReportGroupBySchema>;
export type ReportSectionSchemaType = z.infer<typeof ReportSectionSchema>;
export type ReportScheduleSchemaType = z.infer<typeof ReportScheduleSchema>;
export type ReportExportConfigSchemaType = z.infer<typeof ReportExportConfigSchema>;
export type ReportSchemaType = z.infer<typeof ReportSchema>;
export type ReportBuilderSchemaType = z.infer<typeof ReportBuilderSchema>;
export type ReportViewerSchemaType = z.infer<typeof ReportViewerSchema>;
