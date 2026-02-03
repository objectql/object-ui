/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label } from '@object-ui/components';
import type { ReportBuilderSchema, ReportSchema, ReportField } from '@object-ui/types';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { ReportViewer } from './ReportViewer';

export interface ReportBuilderProps {
  schema: ReportBuilderSchema;
}

/**
 * ReportBuilder - Interactive report builder component
 * Allows users to configure report fields, filters, grouping, and sections
 */
export const ReportBuilder: React.FC<ReportBuilderProps> = ({ schema }) => {
  const { 
    report: initialReport, 
    dataSources = [], 
    availableFields = [], 
    showPreview = true,
    onSave,
    onCancel
  } = schema;

  const [report, setReport] = useState<ReportSchema>(initialReport || {
    type: 'report',
    title: 'New Report',
    fields: [],
    filters: [],
    sections: []
  });

  const [selectedFields, setSelectedFields] = useState<ReportField[]>(report.fields || []);

  const handleAddField = () => {
    if (availableFields.length > 0 && selectedFields.length < availableFields.length) {
      const nextField = availableFields.find(
        f => !selectedFields.some(sf => sf.name === f.name)
      );
      if (nextField) {
        const newFields = [...selectedFields, nextField];
        setSelectedFields(newFields);
        setReport({ ...report, fields: newFields });
      }
    }
  };

  const handleRemoveField = (index: number) => {
    const newFields = selectedFields.filter((_, i) => i !== index);
    setSelectedFields(newFields);
    setReport({ ...report, fields: newFields });
  };

  const handleFieldChange = (index: number, field: ReportField) => {
    const newFields = [...selectedFields];
    newFields[index] = field;
    setSelectedFields(newFields);
    setReport({ ...report, fields: newFields });
  };

  const handleSave = () => {
    console.log('Saving report:', report);
    if (onSave) {
      // TODO: Trigger onSave handler from schema
      alert('Report saved! (Handler: ' + onSave + ')');
    }
  };

  const handleCancel = () => {
    console.log('Canceling report builder');
    if (onCancel) {
      // TODO: Trigger onCancel handler from schema
    }
  };

  return (
    <div className="space-y-4">
      {/* Builder Form */}
      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>Configure your report settings and fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-title">Report Title</Label>
              <Input
                id="report-title"
                value={report.title || ''}
                onChange={(e) => setReport({ ...report, title: e.target.value })}
                placeholder="Enter report title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">Description</Label>
              <Input
                id="report-description"
                value={report.description || ''}
                onChange={(e) => setReport({ ...report, description: e.target.value })}
                placeholder="Enter report description"
              />
            </div>
          </div>

          {/* Data Source Selection */}
          {dataSources.length > 0 && (
            <div className="space-y-2">
              <Label>Data Source</Label>
              <select className="w-full border rounded-md p-2">
                <option value="">Select a data source</option>
                {dataSources.map((_ds, idx) => (
                  <option key={idx} value={idx}>
                    Data Source {idx + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Field Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Report Fields</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddField}
                disabled={selectedFields.length >= availableFields.length}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </div>

            <div className="space-y-2">
              {selectedFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Field Name</Label>
                      <div className="text-sm font-medium">{field.name}</div>
                    </div>
                    <div>
                      <Label className="text-xs">Aggregation</Label>
                      <select
                        className="w-full border rounded p-1 text-sm"
                        value={field.aggregation || ''}
                        onChange={(e) =>
                          handleFieldChange(index, {
                            ...field,
                            aggregation: e.target.value as any
                          })
                        }
                      >
                        <option value="">None</option>
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                        <option value="min">Min</option>
                        <option value="max">Max</option>
                        <option value="count">Count</option>
                        <option value="distinct">Distinct</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Show in Summary</Label>
                      <input
                        type="checkbox"
                        checked={field.showInSummary || false}
                        onChange={(e) =>
                          handleFieldChange(index, {
                            ...field,
                            showInSummary: e.target.checked
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveField(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {selectedFields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  No fields selected. Click "Add Field" to get started.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {showPreview && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Preview</h3>
          <ReportViewer
            schema={{
              type: 'report-viewer',
              report,
              data: [],
              showToolbar: false,
              allowExport: false,
              allowPrint: false
            }}
          />
        </div>
      )}
    </div>
  );
};
