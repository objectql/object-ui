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
import type { ConfigPanelSchema } from '@object-ui/components';

// ---------------------------------------------------------------------------
// Schema — describes the full ReportConfigPanel structure
// ---------------------------------------------------------------------------

const reportSchema: ConfigPanelSchema = {
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
}: ReportConfigPanelProps) {
  const { draft, isDirty, updateField, discard } = useConfigDraft(config, {
    onUpdate: onFieldChange,
  });

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={reportSchema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={updateField}
      onSave={() => onSave(draft)}
      onDiscard={discard}
    />
  );
}
