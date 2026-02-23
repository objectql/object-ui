/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ConfigPanelRenderer } from '../custom/config-panel-renderer';
import { ConfigFieldRenderer } from '../custom/config-field-renderer';
import { useConfigDraft } from '../hooks/use-config-draft';
import type { ConfigPanelSchema, ConfigField } from '../types/config-panel';

// ─── ConfigPanelRenderer Stories ─────────────────────────────────────────────

const panelMeta = {
  title: 'Config/ConfigPanelRenderer',
  component: ConfigPanelRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ConfigPanelRenderer>;

export default panelMeta;
type Story = StoryObj<typeof panelMeta>;

// Basic schema example
const basicSchema: ConfigPanelSchema = {
  breadcrumb: ['Settings', 'General'],
  sections: [
    {
      key: 'basic',
      title: 'Basic',
      fields: [
        { key: 'title', label: 'Title', type: 'input', placeholder: 'Enter title' },
        { key: 'enabled', label: 'Enabled', type: 'switch', defaultValue: true },
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'manual', label: 'Manual' },
            { value: 'scheduled', label: 'Scheduled' },
          ],
          defaultValue: 'auto',
        },
      ],
    },
    {
      key: 'appearance',
      title: 'Appearance',
      collapsible: true,
      fields: [
        { key: 'theme', label: 'Theme', type: 'select', options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ], defaultValue: 'system' },
        { key: 'accentColor', label: 'Accent color', type: 'color', defaultValue: '#3b82f6' },
        { key: 'fontSize', label: 'Font size', type: 'slider', min: 10, max: 24, step: 1, defaultValue: 14 },
      ],
    },
    {
      key: 'advanced',
      title: 'Advanced',
      collapsible: true,
      defaultCollapsed: true,
      hint: 'These settings are for power users.',
      fields: [
        { key: 'debug', label: 'Debug mode', type: 'checkbox' },
        { key: 'apiEndpoint', label: 'API endpoint', type: 'input', placeholder: 'https://...' },
      ],
    },
  ],
};

function BasicPanelStory() {
  const source = { title: 'My App', enabled: true, mode: 'auto', theme: 'system', accentColor: '#3b82f6', fontSize: 14, debug: false, apiEndpoint: '' };
  const { draft, isDirty, updateField, discard } = useConfigDraft(source);
  return (
    <div style={{ position: 'relative', height: 600, width: 320, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <ConfigPanelRenderer
        open={true}
        onClose={() => alert('Close clicked')}
        schema={basicSchema}
        draft={draft}
        isDirty={isDirty}
        onFieldChange={updateField}
        onSave={() => alert('Saved: ' + JSON.stringify(draft, null, 2))}
        onDiscard={discard}
      />
    </div>
  );
}

export const Basic: Story = {
  render: () => <BasicPanelStory />,
};

// Dashboard-like schema
const dashboardSchema: ConfigPanelSchema = {
  breadcrumb: ['Dashboard', 'Layout'],
  sections: [
    {
      key: 'layout',
      title: 'Layout',
      fields: [
        { key: 'columns', label: 'Columns', type: 'slider', min: 1, max: 12, step: 1, defaultValue: 3 },
        { key: 'gap', label: 'Gap', type: 'slider', min: 0, max: 16, step: 1, defaultValue: 4 },
        { key: 'rowHeight', label: 'Row height', type: 'input', defaultValue: '120', placeholder: 'px' },
      ],
    },
    {
      key: 'data',
      title: 'Data',
      collapsible: true,
      fields: [
        { key: 'refreshInterval', label: 'Refresh interval', type: 'select', options: [
          { value: '0', label: 'Manual' },
          { value: '30', label: '30s' },
          { value: '60', label: '1 min' },
          { value: '300', label: '5 min' },
        ], defaultValue: '0' },
        { key: 'autoRefresh', label: 'Auto-refresh', type: 'switch', defaultValue: false },
      ],
    },
    {
      key: 'appearance',
      title: 'Appearance',
      collapsible: true,
      defaultCollapsed: true,
      fields: [
        { key: 'showTitle', label: 'Show title', type: 'switch', defaultValue: true },
        { key: 'showDescription', label: 'Show description', type: 'switch', defaultValue: true },
        { key: 'theme', label: 'Theme', type: 'select', options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'auto', label: 'Auto' },
        ], defaultValue: 'auto' },
      ],
    },
  ],
};

function DashboardPanelStory() {
  const source = { columns: 3, gap: 4, rowHeight: '120', refreshInterval: '0', autoRefresh: false, showTitle: true, showDescription: true, theme: 'auto' };
  const { draft, isDirty, updateField, discard } = useConfigDraft(source);
  return (
    <div style={{ position: 'relative', height: 600, width: 320, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <ConfigPanelRenderer
        open={true}
        onClose={() => alert('Close')}
        schema={dashboardSchema}
        draft={draft}
        isDirty={isDirty}
        onFieldChange={updateField}
        onSave={() => alert('Saved!')}
        onDiscard={discard}
      />
    </div>
  );
}

export const DashboardConfig: Story = {
  render: () => <DashboardPanelStory />,
};

// Custom field escape hatch
const customSchema: ConfigPanelSchema = {
  breadcrumb: ['View', 'Config'],
  sections: [
    {
      key: 'main',
      title: 'General',
      fields: [
        { key: 'name', label: 'View name', type: 'input' },
        {
          key: 'rowHeight',
          label: 'Row height',
          type: 'custom',
          render: (value, onChange) => (
            <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
              {['compact', 'medium', 'tall'].map((h) => (
                <button
                  key={h}
                  onClick={() => onChange(h)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    borderRadius: 4,
                    border: value === h ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    background: value === h ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          ),
        },
      ],
    },
  ],
};

function CustomFieldStory() {
  const source = { name: 'My Grid View', rowHeight: 'medium' };
  const { draft, isDirty, updateField, discard } = useConfigDraft(source);
  return (
    <div style={{ position: 'relative', height: 400, width: 320, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <ConfigPanelRenderer
        open={true}
        onClose={() => {}}
        schema={customSchema}
        draft={draft}
        isDirty={isDirty}
        onFieldChange={updateField}
        onSave={() => alert('Saved!')}
        onDiscard={discard}
      />
    </div>
  );
}

export const CustomFieldEscapeHatch: Story = {
  render: () => <CustomFieldStory />,
};
