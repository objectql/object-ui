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
} from '@object-ui/components';
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
// Schema — describes the WidgetConfigPanel structure
// ---------------------------------------------------------------------------

const widgetSchema: ConfigPanelSchema = {
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
        {
          key: 'object',
          label: 'Data source',
          type: 'input',
          placeholder: 'Object name',
        },
        {
          key: 'categoryField',
          label: 'Category field',
          type: 'input',
          placeholder: 'e.g. status',
        },
        {
          key: 'valueField',
          label: 'Value field',
          type: 'input',
          placeholder: 'e.g. amount',
        },
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
}: WidgetConfigPanelProps) {
  const { draft, isDirty, updateField, discard } = useConfigDraft(config, {
    onUpdate: onFieldChange,
  });

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={widgetSchema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={updateField}
      onSave={() => onSave(draft)}
      onDiscard={discard}
      headerExtra={headerExtra}
    />
  );
}
