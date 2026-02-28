/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  ConfigPanelRenderer,
  useConfigDraft,
  Checkbox,
  Button,
} from '@object-ui/components';
import type { ConfigPanelSchema } from '@object-ui/components';
import { Plus, Trash2 } from 'lucide-react';
import { ScheduleConfig } from './ScheduleConfig';

// ---------------------------------------------------------------------------
// Field definition for filter/sort sub-editors
// ---------------------------------------------------------------------------

export type AvailableField = {
  value: string;
  label: string;
  type?: string;
  options?: Array<{ value: string; label: string }>;
};

// ---------------------------------------------------------------------------
// Aggregation options — reused across FieldPicker & summary
// ---------------------------------------------------------------------------

const AGGREGATION_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

// ---------------------------------------------------------------------------
// FieldPicker — multi-select field picker with per-column aggregation
// ---------------------------------------------------------------------------

function FieldPicker({
  availableFields,
  value,
  onChange,
}: {
  availableFields: AvailableField[];
  value: any;
  onChange: (v: any) => void;
}) {
  const selectedList: Array<{ name: string; label: string; type: string; aggregation?: string }> =
    Array.isArray(value)
      ? value.map((f: any) => (typeof f === 'string'
          ? { name: f, label: f, type: 'string' }
          : { name: f.name || f.field || f.value, label: f.label || f.name || '', type: f.type || 'string', aggregation: f.aggregation }
        ))
      : [];

  const selectedNames = selectedList.map((f) => f.name);

  const toggleField = (fieldValue: string) => {
    const isSelected = selectedNames.includes(fieldValue);
    let updated: typeof selectedList;
    if (isSelected) {
      updated = selectedList.filter((f) => f.name !== fieldValue);
    } else {
      const def = availableFields.find((af) => af.value === fieldValue);
      updated = [...selectedList, { name: fieldValue, label: def?.label || fieldValue, type: def?.type || 'string' }];
    }
    onChange(updated);
  };

  const updateAggregation = (fieldName: string, aggregation: string) => {
    const updated = selectedList.map((f) =>
      f.name === fieldName
        ? { ...f, aggregation: aggregation || undefined, showInSummary: !!aggregation }
        : f,
    );
    onChange(updated);
  };

  if (availableFields.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2" data-testid="field-picker-empty">
        No fields available
      </div>
    );
  }

  return (
    <div className="space-y-1 py-1" data-testid="field-picker">
      {availableFields.map((field) => {
        const checked = selectedNames.includes(field.value);
        const selected = selectedList.find((f) => f.name === field.value);
        return (
          <div key={field.value} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 text-xs">
            <label className="flex items-center gap-2 flex-1 cursor-pointer">
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleField(field.value)}
                data-testid={`field-picker-${field.value}`}
              />
              <span className="flex-1">{field.label}</span>
              {field.type && (
                <span className="text-[10px] text-muted-foreground">{field.type}</span>
              )}
            </label>
            {checked && (
              <select
                className="h-5 text-[10px] border rounded px-1 bg-background"
                value={selected?.aggregation || ''}
                onChange={(e) => updateAggregation(field.value, e.target.value)}
                data-testid={`field-agg-${field.value}`}
              >
                {AGGREGATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartConfig — visual chart type & field mapping editor
// ---------------------------------------------------------------------------

const CHART_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
];

function ChartConfig({
  availableFields,
  value,
  onChange,
}: {
  availableFields: AvailableField[];
  value: any;
  onChange: (v: any) => void;
}) {
  const chart = value || {};
  const updateChart = (updates: any) => onChange({ ...chart, ...updates });

  return (
    <div className="space-y-2 py-1" data-testid="chart-config">
      <div>
        <label className="text-[10px] text-muted-foreground">Chart type</label>
        <select
          className="w-full h-7 text-xs border rounded px-2 bg-background"
          value={chart.chartType || ''}
          onChange={(e) => updateChart({ chartType: e.target.value || undefined })}
          data-testid="chart-type-select"
        >
          {CHART_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {chart.chartType && (
        <>
          <div>
            <label className="text-[10px] text-muted-foreground">X-axis field</label>
            <select
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={chart.xAxisField || ''}
              onChange={(e) => updateChart({ xAxisField: e.target.value || undefined })}
              data-testid="chart-x-field"
            >
              <option value="">Select field…</option>
              {availableFields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Y-axis field</label>
            <select
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={chart.yAxisFields?.[0] || ''}
              onChange={(e) => updateChart({ yAxisFields: e.target.value ? [e.target.value] : [] })}
              data-testid="chart-y-field"
            >
              <option value="">Select field…</option>
              {availableFields.filter((f) => f.type === 'number').map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConditionalFormatRules — rule-based formatting for fields
// ---------------------------------------------------------------------------

const CF_OPERATOR_OPTIONS = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'contains', label: 'Contains' },
];

function ConditionalFormatRules({
  availableFields,
  value,
  onChange,
}: {
  availableFields: AvailableField[];
  value: any;
  onChange: (v: any) => void;
}) {
  const rules: Array<{ field: string; operator: string; value: string; backgroundColor?: string; textColor?: string }> =
    Array.isArray(value) ? value : [];

  const addRule = () => {
    onChange([
      ...rules,
      {
        field: availableFields[0]?.value || '',
        operator: 'equals',
        value: '',
        backgroundColor: '#fef9c3',
        textColor: '',
      },
    ]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: any) => {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  return (
    <div className="space-y-2 py-1" data-testid="conditional-format-rules">
      {rules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-1 text-[10px] p-1 border rounded bg-muted/20">
          <select
            className="h-5 text-[10px] border rounded px-1 bg-background flex-1"
            value={rule.field}
            onChange={(e) => updateRule(idx, { field: e.target.value })}
            data-testid={`cf-rule-field-${idx}`}
          >
            {availableFields.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            className="h-5 text-[10px] border rounded px-1 bg-background w-12"
            value={rule.operator}
            onChange={(e) => updateRule(idx, { operator: e.target.value })}
          >
            {CF_OPERATOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            className="h-5 text-[10px] border rounded px-1 bg-background w-16"
            value={rule.value}
            placeholder="value"
            onChange={(e) => updateRule(idx, { value: e.target.value })}
            data-testid={`cf-rule-value-${idx}`}
          />
          <input
            type="color"
            className="h-5 w-5 rounded border cursor-pointer"
            value={rule.backgroundColor || '#fef9c3'}
            onChange={(e) => updateRule(idx, { backgroundColor: e.target.value })}
            title="Background color"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={() => removeRule(idx)}
            data-testid={`cf-rule-remove-${idx}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 text-[10px] w-full"
        onClick={addRule}
        data-testid="cf-add-rule"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Rule
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionManager — manage report sections (add/remove/reorder)
// ---------------------------------------------------------------------------

const SECTION_TYPE_OPTIONS = [
  { value: 'header', label: 'Header' },
  { value: 'summary', label: 'Summary' },
  { value: 'table', label: 'Table' },
  { value: 'chart', label: 'Chart' },
  { value: 'text', label: 'Text' },
];

function SectionManager({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const sections: Array<{ type: string; title?: string; visible?: boolean }> =
    Array.isArray(value) ? value : [];

  const addSection = (type: string) => {
    onChange([...sections, { type, title: `New ${type}`, visible: true }]);
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, updates: any) => {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-2 py-1" data-testid="section-manager">
      {sections.map((section, idx) => (
        <div key={idx} className="flex items-center gap-1 text-[10px] p-1.5 border rounded bg-muted/20">
          <div className="flex flex-col gap-0.5 mr-1">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={idx === 0}
              onClick={() => moveSection(idx, -1)}
              data-testid={`section-up-${idx}`}
            >▲</button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={idx === sections.length - 1}
              onClick={() => moveSection(idx, 1)}
              data-testid={`section-down-${idx}`}
            >▼</button>
          </div>
          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded uppercase font-medium shrink-0">
            {section.type}
          </span>
          <input
            className="h-5 text-[10px] border rounded px-1 bg-background flex-1 min-w-0"
            value={section.title || ''}
            placeholder="Section title"
            onChange={(e) => updateSection(idx, { title: e.target.value })}
            data-testid={`section-title-${idx}`}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 shrink-0"
            onClick={() => removeSection(idx)}
            data-testid={`section-remove-${idx}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-1 flex-wrap">
        {SECTION_TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={() => addSection(opt.value)}
            data-testid={`section-add-${opt.value}`}
          >
            <Plus className="h-3 w-3 mr-0.5" />
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema builder — produces schema from available fields
// ---------------------------------------------------------------------------

function buildReportSchema(
  availableFields: AvailableField[] = [],
): ConfigPanelSchema {
  return {
    breadcrumb: ['Report', 'Configuration'],
    sections: [
      {
        key: 'basic',
        title: 'Basic',
        fields: [
          {
            key: 'title',
            label: 'Title',
            type: 'input',
            placeholder: 'Report title',
          },
          {
            key: 'description',
            label: 'Description',
            type: 'input',
            placeholder: 'Report description',
          },
          {
            key: 'reportType',
            label: 'Report type',
            type: 'select',
            defaultValue: 'tabular',
            options: [
              { value: 'tabular', label: 'Tabular' },
              { value: 'summary', label: 'Summary' },
              { value: 'matrix', label: 'Matrix' },
            ],
            helpText: 'Tabular: flat table. Summary: grouped with subtotals. Matrix: pivot table (planned).',
          },
        ],
      },
      {
        key: 'data',
        title: 'Data',
        collapsible: true,
        fields: [
          {
            key: 'objectName',
            label: 'Data source',
            type: 'input',
            placeholder: 'e.g. opportunity',
            helpText: 'Object name to query data from',
          },
          {
            key: 'limit',
            label: 'Row limit',
            type: 'input',
            defaultValue: '100',
            placeholder: 'e.g. 100',
          },
        ],
      },
      {
        key: 'columns',
        title: 'Columns',
        collapsible: true,
        hint: 'Select fields to display as report columns. Set aggregation per column for summary reports.',
        fields: [
          {
            key: 'fields',
            label: 'Report columns',
            type: 'custom',
            render: (value: any, onChange: (v: any) => void) => (
              <FieldPicker
                availableFields={availableFields}
                value={value}
                onChange={onChange}
              />
            ),
          },
        ],
      },
      {
        key: 'filters',
        title: 'Filters',
        collapsible: true,
        hint: 'Define filter conditions for the report data',
        fields: [
          {
            key: 'filters',
            label: 'Conditions',
            type: 'filter',
            fields: availableFields,
          },
        ],
      },
      {
        key: 'groupBy',
        title: 'Group By',
        collapsible: true,
        hint: 'Group report data and compute aggregations',
        fields: [
          {
            key: 'groupBy',
            label: 'Grouping',
            type: 'sort',
            fields: availableFields,
          },
        ],
      },
      {
        key: 'chart',
        title: 'Chart',
        collapsible: true,
        hint: 'Add a chart visualization to the report',
        fields: [
          {
            key: 'chartConfig',
            label: 'Chart',
            type: 'custom',
            render: (value: any, onChange: (v: any) => void) => (
              <ChartConfig
                availableFields={availableFields}
                value={value}
                onChange={onChange}
              />
            ),
          },
        ],
      },
      {
        key: 'conditionalFormatting',
        title: 'Conditional Format',
        collapsible: true,
        defaultCollapsed: true,
        hint: 'Highlight cells based on field value conditions',
        fields: [
          {
            key: 'conditionalFormatting',
            label: 'Rules',
            type: 'custom',
            render: (value: any, onChange: (v: any) => void) => (
              <ConditionalFormatRules
                availableFields={availableFields}
                value={value}
                onChange={onChange}
              />
            ),
          },
        ],
      },
      {
        key: 'sections',
        title: 'Sections',
        collapsible: true,
        defaultCollapsed: true,
        hint: 'Manage report layout blocks (header, table, chart, summary)',
        fields: [
          {
            key: 'sections',
            label: 'Report sections',
            type: 'custom',
            render: (value: any, onChange: (v: any) => void) => (
              <SectionManager value={value} onChange={onChange} />
            ),
          },
        ],
      },
      {
        key: 'export',
        title: 'Export',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            key: 'showExportButtons',
            label: 'Show export buttons',
            type: 'switch',
            defaultValue: true,
          },
          {
            key: 'showPrintButton',
            label: 'Show print button',
            type: 'switch',
            defaultValue: true,
          },
          {
            key: 'defaultExportFormat',
            label: 'Default export format',
            type: 'select',
            defaultValue: 'pdf',
            options: [
              { value: 'pdf', label: 'PDF' },
              { value: 'excel', label: 'Excel' },
              { value: 'csv', label: 'CSV' },
              { value: 'json', label: 'JSON' },
              { value: 'html', label: 'HTML' },
            ],
          },
        ],
      },
      {
        key: 'schedule',
        title: 'Schedule',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            key: 'schedule',
            label: 'Schedule',
            type: 'custom',
            render: (value: any, onChange: (v: any) => void) => (
              <ScheduleConfig schedule={value} onChange={onChange} />
            ),
          },
        ],
      },
      {
        key: 'appearance',
        title: 'Appearance',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            key: 'showToolbar',
            label: 'Show toolbar',
            type: 'switch',
            defaultValue: true,
          },
          {
            key: 'refreshInterval',
            label: 'Refresh interval',
            type: 'select',
            defaultValue: '0',
            options: [
              { value: '0', label: 'Manual' },
              { value: '30', label: '30s' },
              { value: '60', label: '1 min' },
              { value: '300', label: '5 min' },
            ],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReportConfigPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Initial / committed report configuration */
  config: Record<string, any>;
  /** Persist the updated config */
  onSave: (config: Record<string, any>) => void;
  /** Optional live-update callback */
  onFieldChange?: (field: string, value: any) => void;
  /** Available fields for filter/sort sub-editors */
  availableFields?: AvailableField[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReportConfigPanel — Schema-driven configuration panel for reports.
 *
 * Built entirely on the generic ConfigPanelRenderer + useConfigDraft,
 * mirroring the DashboardConfigPanel pattern so that report configuration
 * uses the same schema-driven approach as all other view types.
 */
export function ReportConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
  availableFields,
}: ReportConfigPanelProps) {
  const { draft, isDirty, updateField, discard, undo, redo, canUndo, canRedo } = useConfigDraft(config, {
    onUpdate: onFieldChange,
  });

  const schema = React.useMemo(
    () => buildReportSchema(availableFields),
    [availableFields],
  );

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={schema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={updateField}
      onSave={() => onSave(draft)}
      onDiscard={discard}
      onUndo={undo}
      onRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
    />
  );
}
