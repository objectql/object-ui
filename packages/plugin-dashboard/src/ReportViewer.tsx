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
import type { ReportViewerSchema, ReportSection } from '@object-ui/types';
import { Download, Printer, RefreshCw } from 'lucide-react';

export interface ReportViewerProps {
  schema: ReportViewerSchema;
}

/**
 * ReportViewer - Display a generated report with optional toolbar
 * Supports rendering report sections, charts, tables, and export functionality
 */
export const ReportViewer: React.FC<ReportViewerProps> = ({ schema }) => {
  const { 
    report, 
    data, 
    showToolbar = true, 
    allowExport = true, 
    allowPrint = true, 
    loading = false 
  } = schema;

  const handleExport = (format: string) => {
    console.log('Export report as:', format);
    // TODO: Implement export functionality
    alert(`Export to ${format.toUpperCase()} - Feature coming soon!`);
  };

  const handlePrint = () => {
    console.log('Print report');
    window.print();
  };

  const handleRefresh = () => {
    console.log('Refresh report');
    // TODO: Trigger data refresh
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
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport(report.defaultExportFormat || 'pdf')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </>
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
                      ?.filter(f => f.showInSummary)
                      .map((field, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground">{field.label || field.name}</div>
                            <div className="text-2xl font-bold">
                              {/* Calculate aggregation from data */}
                              {field.aggregation === 'count' && data?.length}
                              {field.aggregation === 'sum' && data?.reduce((sum, item) => sum + (item[field.name] || 0), 0)}
                              {/* TODO: Implement other aggregations */}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}

                {section.type === 'chart' && section.chart && (
                  <div className="min-h-[300px]">
                    <SchemaRenderer schema={{ ...section.chart, data: data || section.chart.data }} />
                  </div>
                )}

                {section.type === 'table' && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {section.columns?.map((col, idx) => (
                            <th key={idx} className="px-4 py-2 text-left font-medium">
                              {col.label || col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data?.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-t">
                            {section.columns?.map((col, colIdx) => (
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
                    {report.fields?.map((field, idx) => (
                      <th key={idx} className="px-4 py-2 text-left font-medium">
                        {field.label || field.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t">
                      {report.fields?.map((field, colIdx) => (
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
