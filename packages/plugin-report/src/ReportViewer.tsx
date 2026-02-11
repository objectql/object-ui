/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import type { ReportViewerSchema, ReportSection, ReportExportFormat, ReportField } from '@object-ui/types';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { exportReport } from './ReportExportEngine';

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
            <div className="text-center py-8 text-muted-foreground">
              Loading report data...
            </div>
          )}

          {!loading && report.sections?.map((section: ReportSection, index: number) => {
            // Check visibility condition
            if (section.visible === false) {
              return null;
            }

            return (
              <div key={index} className="space-y-2">
                {/* Section Title */}
                {section.title && (
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
                              {computeAggregation(field.name, field.aggregation)}
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
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {section.columns?.map((col: ReportField, idx: number) => (
                            <th key={idx} className="px-4 py-2 text-left font-medium">
                              {col.label || col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data?.map((row: Record<string, any>, rowIdx: number) => (
                          <tr key={rowIdx} className="border-t">
                            {section.columns?.map((col: ReportField, colIdx: number) => (
                              <td key={colIdx} className="px-4 py-2">
                                {row[col.name]}
                              </td>
                            ))}
                          </tr>
                        ))}
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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {report.fields?.map((field: ReportField, idx: number) => (
                      <th key={idx} className="px-4 py-2 text-left font-medium">
                        {field.label || field.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: Record<string, any>, rowIdx: number) => (
                    <tr key={rowIdx} className="border-t">
                      {report.fields?.map((field: ReportField, colIdx: number) => (
                        <td key={colIdx} className="px-4 py-2">
                          {row[field.name]}
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
