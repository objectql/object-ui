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
  Combobox,
} from '@object-ui/components';
import { ConfigRow } from '@object-ui/components';
import type { ConfigPanelSchema, ConfigField } from '@object-ui/components';

// ---------------------------------------------------------------------------
// Widget type options derived from @object-ui/types DASHBOARD_WIDGET_TYPES
// ---------------------------------------------------------------------------

const WIDGET_TYPE_OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'table', label: 'Table' },
  { value: 'pivot', label: 'Pivot Table' },
  { value: 'list', label: 'List' },
  { value: 'custom', label: 'Custom' },
];

const COLOR_VARIANT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'blue', label: 'Blue' },
  { value: 'teal', label: 'Teal' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
];

const AGGREGATE_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'donut', 'scatter'];

function isChartType(t: string | undefined): boolean {
  return !!t && CHART_TYPES.includes(t);
}

const SORT_BY_OPTIONS = [
  { value: 'group', label: 'Group' },
  { value: 'value', label: 'Value' },
];

const SORT_ORDER_OPTIONS = [
  { value: 'asc', label: '↑' },
  { value: 'desc', label: '↓' },
];

// ---------------------------------------------------------------------------
// Schema builder — creates a ConfigPanelSchema with dynamic options for
// object/field selectors when metadata is available.  Sections are shown or
// hidden based on the current widget type via `visibleWhen`.
// ---------------------------------------------------------------------------

export type SelectOption = { value: string; label: string };

function buildFieldCombobox(
  key: string,
  label: string,
  placeholder: string,
  availableFields: SelectOption[] | undefined,
): ConfigField {
  return {
    key,
    label,
    type: 'custom',
    render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => (
      <ConfigRow label={label}>
        <div data-testid={`config-field-${key}`}>
          <Combobox
            options={availableFields ?? []}
            value={value ?? ''}
            onValueChange={onChange}
            placeholder={placeholder}
            searchPlaceholder="Search fields…"
            emptyText="No fields found."
            className="h-7 w-32 text-xs"
            disabled={!draft.object}
          />
        </div>
      </ConfigRow>
    ),
  };
}

function buildWidgetSchema(
  availableObjects?: SelectOption[],
  availableFields?: SelectOption[],
  widgetType?: string,
): ConfigPanelSchema {
  const hasObjects = availableObjects && availableObjects.length > 0;

  const objectField: ConfigField = hasObjects
    ? {
        key: 'object',
        label: 'Data source',
        type: 'custom',
        render: (value: any, onChange: (v: any) => void) => (
          <ConfigRow label="Data source">
            <div data-testid="config-field-object">
              <Combobox
                options={availableObjects}
                value={value ?? ''}
                onValueChange={onChange}
                placeholder="Select object…"
                searchPlaceholder="Search objects…"
                emptyText="No objects found."
                className="h-7 w-32 text-xs"
              />
            </div>
          </ConfigRow>
        ),
      }
    : {
        key: 'object',
        label: 'Data source',
        type: 'input',
        placeholder: 'Object name',
      };

  // --- Chart-specific field selectors (category / value / aggregate) --------

  const categoryFieldDef: ConfigField = hasObjects
    ? buildFieldCombobox('categoryField', 'Category field', 'Select field…', availableFields)
    : {
        key: 'categoryField',
        label: 'Category field',
        type: 'input',
        placeholder: 'e.g. status',
      };

  const valueFieldDef: ConfigField = hasObjects
    ? buildFieldCombobox('valueField', 'Value field', 'Select field…', availableFields)
    : {
        key: 'valueField',
        label: 'Value field',
        type: 'input',
        placeholder: 'e.g. amount',
      };

  // --- Pivot-specific field selectors (row / column / value) ----------------

  const pivotRowField: ConfigField = hasObjects
    ? buildFieldCombobox('rowField', 'Field', 'Select row field…', availableFields)
    : { key: 'rowField', label: 'Field', type: 'input', placeholder: 'e.g. owner' };

  const pivotColumnField: ConfigField = hasObjects
    ? buildFieldCombobox('columnField', 'Field', 'Select column field…', availableFields)
    : { key: 'columnField', label: 'Field', type: 'input', placeholder: 'e.g. stage' };

  const pivotValueField: ConfigField = hasObjects
    ? buildFieldCombobox('pivotValueField', 'Field', 'Select value field…', availableFields)
    : { key: 'pivotValueField', label: 'Field', type: 'input', placeholder: 'e.g. amount' };

  // ---- Breadcrumb varies by widget type ------------------------------------

  const BREADCRUMB_LABELS: Record<string, string> = {
    pivot: 'Pivot table',
    table: 'Table',
  };
  const typeName = BREADCRUMB_LABELS[widgetType ?? '']
    ?? (isChartType(widgetType) ? 'Chart' : 'Widget');

  return {
    breadcrumb: ['Dashboard', typeName],
    sections: [
      // ----- General (always visible) -------------------------------------
      {
        key: 'general',
        title: 'General',
        fields: [
          {
            key: 'title',
            label: 'Title',
            type: 'input',
            placeholder: 'Widget title',
          },
          {
            key: 'description',
            label: 'Description',
            type: 'input',
            placeholder: 'Widget description',
          },
          {
            key: 'type',
            label: 'Widget type',
            type: 'select',
            options: WIDGET_TYPE_OPTIONS,
            defaultValue: 'metric',
          },
        ],
      },

      // ----- Data Binding (chart / metric / table / list / custom) ---------
      {
        key: 'data',
        title: 'Data Binding',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => d.type !== 'pivot',
        fields: [
          objectField,
          categoryFieldDef,
          valueFieldDef,
          {
            key: 'aggregate',
            label: 'Aggregation',
            type: 'select',
            options: AGGREGATE_OPTIONS,
            defaultValue: 'count',
          },
        ],
      },

      // ----- Pivot: Data source -------------------------------------------
      {
        key: 'pivot-data',
        title: 'Data',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => d.type === 'pivot',
        fields: [
          objectField,
        ],
      },

      // ----- Pivot: Rows --------------------------------------------------
      {
        key: 'pivot-rows',
        title: 'Rows',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => d.type === 'pivot',
        fields: [
          pivotRowField,
          {
            key: 'rowSortBy',
            label: 'Sort by',
            type: 'icon-group',
            options: SORT_BY_OPTIONS,
            defaultValue: 'group',
          },
          {
            key: 'rowSortOrder',
            label: 'Sort order',
            type: 'icon-group',
            options: SORT_ORDER_OPTIONS,
            defaultValue: 'asc',
          },
          {
            key: 'showRowLabels',
            label: 'Show label',
            type: 'switch',
            defaultValue: true,
          },
          {
            key: 'showRowTotals',
            label: 'Show totals',
            type: 'switch',
            defaultValue: false,
          },
        ],
      },

      // ----- Pivot: Columns -----------------------------------------------
      {
        key: 'pivot-columns',
        title: 'Columns',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => d.type === 'pivot',
        fields: [
          pivotColumnField,
          {
            key: 'columnSortBy',
            label: 'Sort by',
            type: 'icon-group',
            options: SORT_BY_OPTIONS,
            defaultValue: 'group',
          },
          {
            key: 'columnSortOrder',
            label: 'Sort order',
            type: 'icon-group',
            options: SORT_ORDER_OPTIONS,
            defaultValue: 'asc',
          },
          {
            key: 'showColumnLabels',
            label: 'Show label',
            type: 'switch',
            defaultValue: true,
          },
          {
            key: 'showColumnTotals',
            label: 'Show totals',
            type: 'switch',
            defaultValue: false,
          },
        ],
      },

      // ----- Pivot: Values ------------------------------------------------
      {
        key: 'pivot-values',
        title: 'Values',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => d.type === 'pivot',
        fields: [
          pivotValueField,
          {
            key: 'aggregation',
            label: 'Aggregation',
            type: 'select',
            options: AGGREGATE_OPTIONS,
            defaultValue: 'sum',
          },
          {
            key: 'format',
            label: 'Number format',
            type: 'input',
            placeholder: 'e.g. $,.2f',
          },
        ],
      },

      // ----- Chart: Axis & Series (visible for chart types) ---------------
      {
        key: 'chart-axis',
        title: 'Axis & Series',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => isChartType(d.type),
        fields: [
          {
            key: 'xAxisLabel',
            label: 'X-axis label',
            type: 'input',
            placeholder: 'e.g. Month',
          },
          {
            key: 'yAxisLabel',
            label: 'Y-axis label',
            type: 'input',
            placeholder: 'e.g. Revenue',
          },
          {
            key: 'showLegend',
            label: 'Show legend',
            type: 'switch',
            defaultValue: true,
          },
        ],
      },

      // ----- Table: Column config (visible for table type) ----------------
      {
        key: 'table-columns',
        title: 'Columns',
        collapsible: true,
        visibleWhen: (d: Record<string, any>) => d.type === 'table',
        fields: [
          {
            key: 'searchable',
            label: 'Searchable',
            type: 'switch',
            defaultValue: false,
          },
          {
            key: 'pagination',
            label: 'Pagination',
            type: 'switch',
            defaultValue: false,
          },
        ],
      },

      // ----- Layout (always visible) --------------------------------------
      {
        key: 'layout',
        title: 'Layout',
        collapsible: true,
        fields: [
          {
            key: 'layoutW',
            label: 'Width (columns)',
            type: 'slider',
            min: 1,
            max: 12,
            step: 1,
            defaultValue: 1,
          },
          {
            key: 'layoutH',
            label: 'Height (rows)',
            type: 'slider',
            min: 1,
            max: 6,
            step: 1,
            defaultValue: 1,
          },
        ],
      },

      // ----- Appearance (always visible, collapsed by default) ------------
      {
        key: 'appearance',
        title: 'Appearance',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            key: 'colorVariant',
            label: 'Color variant',
            type: 'select',
            options: COLOR_VARIANT_OPTIONS,
            defaultValue: 'default',
          },
          {
            key: 'actionUrl',
            label: 'Action URL',
            type: 'input',
            placeholder: 'https://...',
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WidgetConfigPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Widget configuration (flattened: layout.w → layoutW, layout.h → layoutH) */
  config: Record<string, any>;
  /** Persist the updated widget config */
  onSave: (config: Record<string, any>) => void;
  /** Optional live-update callback */
  onFieldChange?: (field: string, value: any) => void;
  /** Extra content rendered in the header row (e.g. delete button) */
  headerExtra?: React.ReactNode;
  /** Available data-source objects for dropdown selection */
  availableObjects?: SelectOption[];
  /** Available fields of the currently selected object for dropdown selection */
  availableFields?: SelectOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Resolve an I18nLabel (string or {key, defaultValue}) to a plain string. */
function resolveLabel(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const obj = v as Record<string, any>;
    return obj.defaultValue || obj.key || '';
  }
  return String(v);
}

/**
 * WidgetConfigPanel — Schema-driven configuration panel for individual
 * dashboard widgets.
 *
 * Supports editing: title, description, type, data binding (object,
 * categoryField, valueField, aggregate), layout (width, height),
 * appearance (colorVariant, actionUrl).
 *
 * Sections are context-aware: pivot, table, and chart types each show
 * their own dedicated config sections via `visibleWhen` predicates.
 */
export function WidgetConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
  headerExtra,
  availableObjects,
  availableFields,
}: WidgetConfigPanelProps) {
  // Pre-process config to resolve any I18nLabel values for title/description
  const normalizedConfig = React.useMemo(() => ({
    ...config,
    title: typeof config.title === 'object' ? resolveLabel(config.title) : config.title,
    description: typeof config.description === 'object' ? resolveLabel(config.description) : config.description,
  }), [config]);

  const { draft, isDirty, updateField, discard } = useConfigDraft(normalizedConfig, {
    onUpdate: onFieldChange,
  });

  const schema = React.useMemo(
    () => buildWidgetSchema(availableObjects, availableFields, draft.type),
    [availableObjects, availableFields, draft.type],
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
      headerExtra={headerExtra}
    />
  );
}
