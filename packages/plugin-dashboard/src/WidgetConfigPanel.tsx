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
// Schema builder — creates a ConfigPanelSchema with dynamic options for
// object/field selectors when metadata is available.
// ---------------------------------------------------------------------------

export type SelectOption = { value: string; label: string };

function buildWidgetSchema(
  availableObjects?: SelectOption[],
  availableFields?: SelectOption[],
): ConfigPanelSchema {
  const hasObjects = availableObjects && availableObjects.length > 0;
  const hasFields = availableFields && availableFields.length > 0;

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

  const categoryFieldDef: ConfigField = hasObjects
    ? {
        key: 'categoryField',
        label: 'Category field',
        type: 'custom',
        render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => (
          <ConfigRow label="Category field">
            <div data-testid="config-field-categoryField">
              <Combobox
                options={hasFields ? availableFields : []}
                value={value ?? ''}
                onValueChange={onChange}
                placeholder="Select field…"
                searchPlaceholder="Search fields…"
                emptyText="No fields found."
                className="h-7 w-32 text-xs"
                disabled={!draft.object}
              />
            </div>
          </ConfigRow>
        ),
      }
    : {
        key: 'categoryField',
        label: 'Category field',
        type: 'input',
        placeholder: 'e.g. status',
      };

  const valueFieldDef: ConfigField = hasObjects
    ? {
        key: 'valueField',
        label: 'Value field',
        type: 'custom',
        render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => (
          <ConfigRow label="Value field">
            <div data-testid="config-field-valueField">
              <Combobox
                options={hasFields ? availableFields : []}
                value={value ?? ''}
                onValueChange={onChange}
                placeholder="Select field…"
                searchPlaceholder="Search fields…"
                emptyText="No fields found."
                className="h-7 w-32 text-xs"
                disabled={!draft.object}
              />
            </div>
          </ConfigRow>
        ),
      }
    : {
        key: 'valueField',
        label: 'Value field',
        type: 'input',
        placeholder: 'e.g. amount',
      };

  return {
    breadcrumb: ['Dashboard', 'Widget'],
    sections: [
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
      {
        key: 'data',
        title: 'Data Binding',
        collapsible: true,
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

/**
 * WidgetConfigPanel — Schema-driven configuration panel for individual
 * dashboard widgets.
 *
 * Supports editing: title, description, type, data binding (object,
 * categoryField, valueField, aggregate), layout (width, height),
 * appearance (colorVariant, actionUrl).
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
  const { draft, isDirty, updateField, discard } = useConfigDraft(config, {
    onUpdate: onFieldChange,
  });

  const schema = React.useMemo(
    () => buildWidgetSchema(availableObjects, availableFields),
    [availableObjects, availableFields],
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
