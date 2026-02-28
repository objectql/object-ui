/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge, Skeleton } from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import type { ReportViewerSchema, ReportSection, ReportExportFormat, ReportField, ReportGroupBy } from '@object-ui/types';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { exportReport } from './ReportExportEngine';
import { formatValue } from './formatValue';

// ---------------------------------------------------------------------------
// Client-side grouping utility
// ---------------------------------------------------------------------------

interface GroupedData {
  key: string;
  label: string;
  rows: Record<string, any>[];
}

function groupData(data: any[], groupBy: ReportGroupBy[]): GroupedData[] | null {
  if (!groupBy || groupBy.length === 0 || !data || data.length === 0) return null;

  const firstGroup = groupBy[0];
  const field = firstGroup.field;
  const groups: Map<string, Record<string, any>[]> = new Map();

  for (const row of data) {
    const key = String(row[field] ?? '(empty)');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const result: GroupedData[] = [];
  for (const [key, rows] of groups) {
    result.push({ key, label: `${firstGroup.label || field}: ${key}`, rows });
  }

  // Sort groups
  const dir = firstGroup.sort === 'desc' ? -1 : 1;
  result.sort((a, b) => a.key.localeCompare(b.key) * dir);

  return result;
}

export interface ReportViewerProps {
  schema: ReportViewerSchema;
  /** Callback to refresh data */
  onRefresh?: () => void;
}

/**
 * ReportViewer - Display a generated report with optional toolbar
 * Supports rendering report sections, charts, tables, and export functionality
 */
export const ReportViewer: React.FC<ReportViewerProps> = ({ schema, onRefresh }) => {
  const { 
    report, 
    data, 
    showToolbar = true, 
    allowExport = true, 
    allowPrint = true, 
    loading = false 
  } = schema;

  const handleExport = (format: string) => {
    if (!report) {
      console.warn('ReportViewer: Cannot export, no report defined');
      return;
    }
    exportReport(format as ReportExportFormat, report, data || [], 
      report.exportConfigs?.[format as ReportExportFormat]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRefresh = () => {
    onRefresh?.();
  };

  const computeAggregation = (fieldName: string, aggregation?: string): string | number => {
    if (!data) return 0;
    const values = data.map((item: Record<string, any>) => Number(item[fieldName]) || 0);
    switch (aggregation) {
      case 'count': return data.length;
      case 'sum': return values.reduce((sum: number, v: number) => sum + v, 0);
      case 'avg': return values.length > 0
        ? (values.reduce((sum: number, v: number) => sum + v, 0) / values.length).toFixed(2)
        : 0;
      case 'min': return values.length > 0 ? Math.min(...values) : 0;
      case 'max': return values.length > 0 ? Math.max(...values) : 0;
      default: return '';
    }
  };

  // Evaluate conditional formatting rules for a cell
  const getCellStyle = (fieldName: string, value: any): React.CSSProperties | undefined => {
    const rules = report?.conditionalFormatting;
    if (!rules || !Array.isArray(rules)) return undefined;

    for (const rule of rules) {
      if (rule.field !== fieldName) continue;
      const strValue = String(value ?? '');
      const ruleValue = String(rule.value ?? '');
      let match = false;
      switch (rule.operator) {
        case 'equals': match = strValue === ruleValue; break;
        case 'not_equals': match = strValue !== ruleValue; break;
        case 'contains': match = strValue.includes(ruleValue); break;
        case 'greater_than': match = Number(value) > Number(rule.value); break;
        case 'less_than': match = Number(value) < Number(rule.value); break;
      }
      if (match) {
        const style: React.CSSProperties = {};
        if (rule.backgroundColor) style.backgroundColor = rule.backgroundColor;
        if (rule.textColor) style.color = rule.textColor;
        return style;
      }
    }
    return undefined;
  };

  const renderCellValue = (value: any, field: ReportField): React.ReactNode => {
    if (value == null || value === '') return '';

    // Badge rendering for fields with renderAs='badge'
    if (field.renderAs === 'badge') {
      const colorClass = field.colorMap?.[String(value)] || '';
      return <Badge className={colorClass}>{String(value)}</Badge>;
    }

    return formatValue(value, field);
  };

  if (!report) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No report to display
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 p-4 bg-card rounded-lg border">
          <div>
            <h2 className="text-lg font-semibold">{report.title}</h2>
            {report.description && (
              <p className="text-sm text-muted-foreground">{report.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {report.refreshInterval && (
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
            {allowPrint && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            )}
            {allowExport && report.showExportButtons && (
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport('pdf')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport('excel')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport('csv')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Content */}
      <Card>
        <CardHeader>
          {!showToolbar && report.title && <CardTitle>{report.title}</CardTitle>}
          {!showToolbar && report.description && <CardDescription>{report.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="space-y-6">
              {/* Skeleton summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-28" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Skeleton table */}
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          )}

          {!loading && report.sections?.map((section: ReportSection, index: number) => {
            // Check visibility condition
            if (section.visible === false) {
              return null;
            }

            return (
              <div key={index} className="space-y-2">
                {/* Section Title - skip for header type since it renders its own title */}
                {section.title && section.type !== 'header' && (
                  <h3 className="text-lg font-semibold border-b pb-2">{section.title}</h3>
                )}

                {/* Section Content */}
                {section.type === 'header' && section.title && (
                  <div className="text-2xl font-bold py-4">{section.title}</div>
                )}

                {section.type === 'summary' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {report.fields
                      ?.filter((f: ReportField) => f.showInSummary)
                      .map((field: ReportField, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground">{field.label || field.name}</div>
                            <div className="text-2xl font-bold">
                              {formatValue(computeAggregation(field.name, field.aggregation), field)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}

                {section.type === 'chart' && section.chart && (
                  <div className="min-h-[300px]">
                    {(() => {
                      // 1. Determine Component Type
                      // If explicit 'type' is missing, but 'chartType' exists (e.g. "line"), infer 'chart'
                      let type = section.chart.type;
                      const hasChartType = !!section.chart.chartType; 
                      
                      // If no strict type but has chartType, assume 'chart' generic renderer
                      if (!type && hasChartType) {
                        type = 'chart';
                      }
                      
                      // Fallback validation: If resolved type is not registered, try 'chart'
                      const isRegistered = type && !!ComponentRegistry.get(type);
                      if (!isRegistered) {
                         // Even if 'line' was somehow passed as type, fallback to 'chart'
                         type = 'chart';
                      }

                      // 2. Data Adapter (Report Schema -> Chart Component Schema)
                      // The generic 'chart' component needs mapped props (xAxisKey, series)
                      // whereas Report schema uses (xAxisField, yAxisFields)
                      const isGenericChart = type === 'chart';
                      const adapterProps = isGenericChart ? {
                        xAxisKey: section.chart.xAxisKey || section.chart.xAxisField || 'name',
                        series: section.chart.series || (section.chart.yAxisFields ? section.chart.yAxisFields.map((f: any) => ({ dataKey: f })) : []),
                        // Ensure chartType is passed if we are using the generic renderer
                        chartType: section.chart.chartType || 'bar',
                      } : {};

                      // 3. Construct Safe Schema
                      const safeSchema = {
                        ...section.chart,
                        type,
                        ...adapterProps,
                        data: data || section.chart.data,
                        // Force explicit height to preventing Recharts "height(-1)" error
                        className: section.chart.className || 'w-full h-[350px]'
                      };

                      return <SchemaRenderer schema={safeSchema} />;
                    })()}
                  </div>
                )}

                {section.type === 'table' && (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="bg-muted">
                        <tr>
                          {section.columns?.map((col: ReportField, idx: number) => (
                            <th key={idx} className={`px-4 py-2 font-medium ${col.type === 'number' ? 'text-right' : 'text-left'}`}>
                              {col.label || col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const groups = groupData(data || [], report.groupBy || []);
                          if (groups) {
                            return groups.map((group) => (
                              <React.Fragment key={group.key}>
                                <tr className="bg-muted/60">
                                  <td
                                    colSpan={section.columns?.length || 1}
                                    className="px-4 py-2 font-semibold text-sm"
                                  >
                                    {group.label} ({group.rows.length})
                                  </td>
                                </tr>
                                {group.rows.map((row: Record<string, any>, rowIdx: number) => (
                                  <tr key={rowIdx} className="border-t hover:bg-muted/50 even:bg-muted/20">
                                    {section.columns?.map((col: ReportField, colIdx: number) => (
                                      <td key={colIdx} className={`px-4 py-2 ${col.type === 'number' ? 'text-right tabular-nums' : ''}`} style={getCellStyle(col.name, row[col.name])}>
                                        {renderCellValue(row[col.name], col)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </React.Fragment>
                            ));
                          }
                          return data?.map((row: Record<string, any>, rowIdx: number) => (
                            <tr key={rowIdx} className="border-t hover:bg-muted/50 even:bg-muted/20">
                              {section.columns?.map((col: ReportField, colIdx: number) => (
                                <td key={colIdx} className={`px-4 py-2 ${col.type === 'number' ? 'text-right tabular-nums' : ''}`} style={getCellStyle(col.name, row[col.name])}>
                                  {renderCellValue(row[col.name], col)}
                                </td>
                              ))}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}

                {section.type === 'text' && section.text && (
                  <div className="prose max-w-none">
                    <p>{section.text}</p>
                  </div>
                )}

                {section.type === 'page-break' && (
                  <div className="border-t-2 border-dashed my-8 print:page-break-after-always" />
                )}

                {section.content && (
                  <SchemaRenderer schema={section.content} />
                )}
              </div>
            );
          })}

          {/* Fallback: Show data if no sections defined */}
          {!report.sections && data && data.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted">
                  <tr>
                    {report.fields?.map((field: ReportField, idx: number) => (
                      <th key={idx} className={`px-4 py-2 font-medium ${field.type === 'number' ? 'text-right' : 'text-left'}`}>
                        {field.label || field.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: Record<string, any>, rowIdx: number) => (
                    <tr key={rowIdx} className="border-t hover:bg-muted/50 even:bg-muted/20">
                      {report.fields?.map((field: ReportField, colIdx: number) => (
                        <td key={colIdx} className={`px-4 py-2 ${field.type === 'number' ? 'text-right tabular-nums' : ''}`} style={getCellStyle(field.name, row[field.name])}>
                          {renderCellValue(row[field.name], field)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
