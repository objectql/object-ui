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
// Schema — describes the full DashboardConfigPanel structure
// ---------------------------------------------------------------------------

const dashboardSchema: ConfigPanelSchema = {
  breadcrumb: ['Dashboard', 'Configuration'],
  sections: [
    {
      key: 'layout',
      title: 'Layout',
      fields: [
        {
          key: 'columns',
          label: 'Columns',
          type: 'slider',
          defaultValue: 3,
          min: 1,
          max: 12,
          step: 1,
        },
        {
          key: 'gap',
          label: 'Gap',
          type: 'slider',
          defaultValue: 4,
          min: 0,
          max: 16,
          step: 1,
        },
        {
          key: 'rowHeight',
          label: 'Row height',
          type: 'input',
          defaultValue: '120',
          placeholder: 'e.g. 120',
        },
      ],
    },
    {
      key: 'data',
      title: 'Data',
      collapsible: true,
      fields: [
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
    {
      key: 'appearance',
      title: 'Appearance',
      collapsible: true,
      defaultCollapsed: true,
      fields: [
        {
          key: 'title',
          label: 'Title',
          type: 'input',
          placeholder: 'Dashboard title',
        },
        {
          key: 'showDescription',
          label: 'Show description',
          type: 'switch',
          defaultValue: true,
        },
        {
          key: 'theme',
          label: 'Theme',
          type: 'select',
          defaultValue: 'auto',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardConfigPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Initial / committed dashboard configuration */
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
 * DashboardConfigPanel — Schema-driven configuration panel for dashboards.
 *
 * Built entirely on the generic ConfigPanelRenderer + useConfigDraft,
 * demonstrating that a full config panel can be expressed in ~60 lines
 * of declarative schema rather than 1500+ lines of imperative code.
 */
export function DashboardConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
}: DashboardConfigPanelProps) {
  const { draft, isDirty, updateField, discard } = useConfigDraft(config, {
    onUpdate: onFieldChange,
  });

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={dashboardSchema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={updateField}
      onSave={() => onSave(draft)}
      onDiscard={discard}
    />
  );
}
