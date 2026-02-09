/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@object-ui/components';
import type { ReportBuilderSchema, ReportSchema, ReportField, ReportFilter, ReportGroupBy, ReportSection } from '@object-ui/types';
import { Plus, Trash2, Save, X, Settings, Filter, Layers, Calendar } from 'lucide-react';
import { ReportViewer } from './ReportViewer';
import { ScheduleConfig } from './ScheduleConfig';

export interface ReportBuilderProps {
  schema: ReportBuilderSchema;
}

/**
 * ReportBuilder - Interactive report builder component
 * Allows users to configure report fields, filters, grouping, sections, and export settings
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
    groupBy: [],
    sections: [],
    showExportButtons: true,
    showPrintButton: true
  });

  const [selectedFields, setSelectedFields] = useState<ReportField[]>(report.fields || []);
  const [filters, setFilters] = useState<ReportFilter[]>(report.filters || []);
  const [groupBy, setGroupBy] = useState<ReportGroupBy[]>(report.groupBy || []);
  const [sections, setSections] = useState<ReportSection[]>(report.sections || []);

  // Field Management
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

  // Filter Management
  const handleAddFilter = () => {
    const newFilter: ReportFilter = {
      field: availableFields[0]?.name || '',
      operator: 'equals',
      value: ''
    };
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    setReport({ ...report, filters: newFilters });
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    setReport({ ...report, filters: newFilters });
  };

  const handleFilterChange = (index: number, filter: ReportFilter) => {
    const newFilters = [...filters];
    newFilters[index] = filter;
    setFilters(newFilters);
    setReport({ ...report, filters: newFilters });
  };

  // Group By Management
  const handleAddGroupBy = () => {
    const newGroupBy: ReportGroupBy = {
      field: availableFields[0]?.name || '',
      sort: 'asc'
    };
    const newGroupByList = [...groupBy, newGroupBy];
    setGroupBy(newGroupByList);
    setReport({ ...report, groupBy: newGroupByList });
  };

  const handleRemoveGroupBy = (index: number) => {
    const newGroupByList = groupBy.filter((_, i) => i !== index);
    setGroupBy(newGroupByList);
    setReport({ ...report, groupBy: newGroupByList });
  };

  const handleGroupByChange = (index: number, group: ReportGroupBy) => {
    const newGroupByList = [...groupBy];
    newGroupByList[index] = group;
    setGroupBy(newGroupByList);
    setReport({ ...report, groupBy: newGroupByList });
  };

  // Section Management
  const handleAddSection = (type: ReportSection['type']) => {
    const newSection: ReportSection = {
      type,
      title: `New ${type} Section`
    };
    const newSections = [...sections, newSection];
    setSections(newSections);
    setReport({ ...report, sections: newSections });
  };

  const handleRemoveSection = (index: number) => {
    const newSections = sections.filter((_, i) => i !== index);
    setSections(newSections);
    setReport({ ...report, sections: newSections });
  };

  const handleSectionChange = (index: number, section: ReportSection) => {
    const newSections = [...sections];
    newSections[index] = section;
    setSections(newSections);
    setReport({ ...report, sections: newSections });
  };

  const handleSave = () => {
    console.log('Saving report:', report);
    if (onSave) {
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
          <CardDescription>Configure your report settings, fields, filters, and sections</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic">
                <Settings className="h-4 w-4 mr-2" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="fields">
                <Layers className="h-4 w-4 mr-2" />
                Fields
              </TabsTrigger>
              <TabsTrigger value="filters">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </TabsTrigger>
              <TabsTrigger value="grouping">
                <Layers className="h-4 w-4 mr-2" />
                Group By
              </TabsTrigger>
              <TabsTrigger value="sections">
                <Layers className="h-4 w-4 mr-2" />
                Sections
              </TabsTrigger>
              <TabsTrigger value="schedule">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </TabsTrigger>
            </TabsList>

            {/* Basic Settings Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
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

                <div className="space-y-2">
                  <Label>Export Options</Label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={report.showExportButtons || false}
                        onChange={(e) => setReport({ ...report, showExportButtons: e.target.checked })}
                      />
                      <span className="text-sm">Show Export Buttons</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={report.showPrintButton || false}
                        onChange={(e) => setReport({ ...report, showPrintButton: e.target.checked })}
                      />
                      <span className="text-sm">Show Print Button</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="export-format">Default Export Format</Label>
                  <select 
                    id="export-format"
                    className="w-full border rounded-md p-2"
                    value={report.defaultExportFormat || 'pdf'}
                    onChange={(e) => setReport({ ...report, defaultExportFormat: e.target.value as any })}
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* Fields Tab */}
            <TabsContent value="fields" className="space-y-4 mt-4">
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
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Field Name</Label>
                        <div className="text-sm font-medium">{field.name}</div>
                      </div>
                      <div>
                        <Label className="text-xs">Label</Label>
                        <Input
                          className="h-8 text-sm"
                          value={field.label || field.name}
                          onChange={(e) => handleFieldChange(index, { ...field, label: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Aggregation</Label>
                        <select
                          className="w-full border rounded-md h-8 text-sm px-2"
                          value={field.aggregation || ''}
                          onChange={(e) => handleFieldChange(index, { ...field, aggregation: e.target.value as any })}
                        >
                          <option value="">None</option>
                          <option value="sum">Sum</option>
                          <option value="count">Count</option>
                          <option value="avg">Average</option>
                          <option value="min">Min</option>
                          <option value="max">Max</option>
                        </select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {selectedFields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    No fields selected. Click "Add Field" to begin.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Filters Tab */}
            <TabsContent value="filters" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Report Filters</Label>
                <Button size="sm" variant="outline" onClick={handleAddFilter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Filter
                </Button>
              </div>

              <div className="space-y-2">
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Field</Label>
                        <select
                          className="w-full border rounded-md h-8 text-sm px-2"
                          value={filter.field}
                          onChange={(e) => handleFilterChange(index, { ...filter, field: e.target.value })}
                        >
                          {availableFields.map((f, i) => (
                            <option key={i} value={f.name}>{f.label || f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                         <Label className="text-xs">Operator</Label>
                         <select
                           className="w-full border rounded-md h-8 text-sm px-2"
                           value={filter.operator}
                           onChange={(e) => handleFilterChange(index, { ...filter, operator: e.target.value as any })}
                         >
                           <option value="equals">Equals</option>
                           <option value="contains">Contains</option>
                           <option value="gt">Greater Than</option>
                           <option value="lt">Less Than</option>
                           <option value="between">Between</option>
                         </select>
                      </div>
                      <div>
                        <Label className="text-xs">Value</Label>
                        <Input
                          className="h-8 text-sm"
                          value={String(filter.value)}
                          onChange={(e) => handleFilterChange(index, { ...filter, value: e.target.value })}
                        />
                      </div>
                    </div>
                     <Button
                       size="sm"
                       variant="ghost"
                       className="text-red-500 hover:text-red-700 hover:bg-red-50 self-end"
                       onClick={() => handleRemoveFilter(index)}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                  </div>
              ))}
                
                {filters.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    No filters defined.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Group By Tab */}
            <TabsContent value="grouping" className="space-y-4 mt-4">
               <div className="flex items-center justify-between">
                  <Label>Grouping Rules</Label>
                  <Button size="sm" variant="outline" onClick={handleAddGroupBy}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </div>
                
                 <div className="space-y-2">
                   {groupBy.map((group, index) => (
                     <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                           <div>
                              <Label className="text-xs">Field</Label>
                              <select
                                 className="w-full border rounded-md h-8 text-sm px-2"
                                 value={group.field}
                                 onChange={(e) => handleGroupByChange(index, { ...group, field: e.target.value })}
                              >
                                 {availableFields.map((f, i) => (
                                    <option key={i} value={f.name}>{f.label || f.name}</option>
                                 ))}
                              </select>
                           </div>
                            <div>
                               <Label className="text-xs">Sort Order</Label>
                               <select
                                  className="w-full border rounded-md h-8 text-sm px-2"
                                  value={group.sort || 'asc'}
                                  onChange={(e) => handleGroupByChange(index, { ...group, sort: e.target.value as 'asc' | 'desc' })}
                               >
                                  <option value="asc">Ascending</option>
                                  <option value="desc">Descending</option>
                               </select>
                            </div>
                        </div>
                         <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 self-end"
                            onClick={() => handleRemoveGroupBy(index)}
                         >
                            <Trash2 className="h-4 w-4" />
                         </Button>
                     </div>
                   ))}
                    {groupBy.length === 0 && (
                       <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          No grouping rules applied.
                       </div>
                    )}
                 </div>
            </TabsContent>

            {/* Sections Tab */}
            <TabsContent value="sections" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Report Sections</Label>
                <div className="flex gap-2">
                   <Button size="sm" variant="outline" onClick={() => handleAddSection('header')}>
                     <Plus className="h-4 w-4 mr-2" />
                     Header
                   </Button>
                   <Button size="sm" variant="outline" onClick={() => handleAddSection('chart')}>
                     <Plus className="h-4 w-4 mr-2" />
                     Chart
                   </Button>
                   <Button size="sm" variant="outline" onClick={() => handleAddSection('table')}>
                     <Plus className="h-4 w-4 mr-2" />
                     Table
                   </Button>
                </div>
              </div>

               <div className="space-y-2">
                 {sections.map((section, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-2">
                       <div className="flex items-center justify-between">
                          <div className="font-medium flex items-center gap-2">
                             <div className="text-xs bg-muted px-2 py-0.5 rounded uppercase">{section.type}</div>
                             {section.title}
                          </div>
                           <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemoveSection(index)}
                           >
                              <Trash2 className="h-4 w-4" />
                           </Button>
                       </div>
                       
                        {/* Simple config for section based on type */}
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <Label className="text-xs">Title</Label>
                                <Input 
                                   className="h-8 text-sm"
                                   value={section.title || ''}
                                   onChange={(e) => handleSectionChange(index, { ...section, title: e.target.value })}
                                />
                             </div>
                              {section.type === 'text' && (
                                   <div className="col-span-2">
                                      <Label className="text-xs">Content</Label>
                                      <Input 
                                         className="h-8 text-sm"
                                         value={section.text || ''}
                                         onChange={(e) => handleSectionChange(index, { ...section, text: e.target.value })}
                                      />
                                   </div>
                              )}
                              {section.type === 'chart' && (
                                 <div className="col-span-2 grid grid-cols-2 gap-2 mt-2 p-2 bg-muted/20 rounded">
                                    <div className="col-span-2">
                                       <Label className="text-xs font-semibold">Chart Configuration</Label>
                                    </div>
                                    <div>
                                       <Label className="text-xs">Chart Type</Label>
                                       <select 
                                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                          value={section.chart?.chartType || 'bar'}
                                          onChange={(e) => handleSectionChange(index, { 
                                             ...section, 
                                             chart: { ...section.chart, type: 'chart', chartType: e.target.value } as any 
                                          })}
                                       >
                                          <option value="bar">Bar</option>
                                          <option value="line">Line</option>
                                          <option value="area">Area</option>
                                          <option value="pie">Pie</option>
                                       </select>
                                    </div>
                                    <div>
                                       <Label className="text-xs">X-Axis Field</Label>
                                       <select 
                                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                          value={section.chart?.xAxisField || ''}
                                          onChange={(e) => handleSectionChange(index, { 
                                             ...section, 
                                             chart: { ...section.chart, type: 'chart', xAxisField: e.target.value } as any
                                          })}
                                       >
                                          <option value="">Select Field...</option>
                                          {availableFields.map(f => (
                                             <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                          ))}
                                          {/* Use mock fields if no available fields provided */}
                                          {availableFields.length === 0 && (
                                             <>
                                                <option value="name">Name</option>
                                                <option value="month">Month</option>
                                             </>
                                          )}
                                       </select>
                                    </div>
                                    <div className="col-span-2">
                                       <Label className="text-xs">Y-Axis Fields (comma separated)</Label>
                                       <Input 
                                          className="h-8 text-sm"
                                          placeholder="e.g. value, count"
                                          value={section.chart?.yAxisFields?.join(', ') || ''}
                                          onChange={(e) => handleSectionChange(index, { 
                                             ...section, 
                                             chart: { 
                                                ...section.chart, 
                                                type: 'chart',
                                                yAxisFields: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                             } as any
                                          })}
                                       />
                                    </div>
                                 </div>
                              )}
                        </div>
                    </div>
                 ))}
                  {sections.length === 0 && (
                     <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No customized sections. The default report layout will be used.
                     </div>
                  )}
               </div>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-4 mt-4">
              <ScheduleConfig
                schedule={report.schedule}
                onChange={(schedule) => setReport({ ...report, schedule })}
              />
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave}>
               <Save className="h-4 w-4 mr-2" />
               Save Report
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Live Preview */}
      {showPreview && (
         <Card className="mt-8 border-2 border-blue-100">
            <CardHeader className="bg-blue-50/50">
               <CardTitle className="text-blue-900 text-sm uppercase tracking-wide">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <ReportViewer 
                   schema={{ 
                      type: 'report-viewer',
                      report: {
                         ...report,
                         fields: selectedFields,
                         filters,
                         groupBy,
                         sections
                      },
                      // Mock data for preview
                      data: [
                         { id: 1, name: 'Sample Item A', value: 100, status: 'New' },
                         { id: 2, name: 'Sample Item B', value: 250, status: 'Active' },
                         { id: 3, name: 'Sample Item C', value: 75, status: 'Closed' },
                      ]
                   }} 
                />
            </CardContent>
         </Card>
      )}
    </div>
  );
};
