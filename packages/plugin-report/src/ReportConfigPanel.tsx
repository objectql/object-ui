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
  Label,
} from '@object-ui/components';
import type { ConfigPanelSchema } from '@object-ui/components';
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
// FieldPicker — inline multi-select field picker for report columns
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
  const selectedFields: string[] = Array.isArray(value)
    ? value.map((f: any) => (typeof f === 'string' ? f : f.name || f.field || f.value))
    : [];

  const toggleField = (fieldValue: string) => {
    const isSelected = selectedFields.includes(fieldValue);
    let updated: string[];
    if (isSelected) {
      updated = selectedFields.filter((f) => f !== fieldValue);
    } else {
      updated = [...selectedFields, fieldValue];
    }
    // Emit as array of {name, label, type} objects for downstream consumption
    onChange(
      updated.map((fv) => {
        const def = availableFields.find((af) => af.value === fv);
        return { name: fv, label: def?.label || fv, type: def?.type || 'string' };
      }),
    );
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
        const checked = selectedFields.includes(field.value);
        return (
          <label
            key={field.value}
            className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
          >
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
        );
      })}
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
        hint: 'Select fields to display as report columns',
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
