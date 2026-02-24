import type { Meta, StoryObj } from '@storybook/react';
import { DashboardEditor } from './DashboardEditor';
import type { DashboardSchema } from '@object-ui/types';
import { useState } from 'react';

const meta = {
  title: 'Designers/DashboardEditor',
  component: DashboardEditor,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DashboardEditor>;

export default meta;
type Story = StoryObj<typeof DashboardEditor>;

function DashboardEditorWrapper(props: { schema: DashboardSchema; readOnly?: boolean }) {
  const [schema, setSchema] = useState<DashboardSchema>(props.schema);
  return (
    <DashboardEditor
      schema={schema}
      onChange={setSchema}
      readOnly={props.readOnly}
      onExport={(s) => console.log('Export:', s)}
      onImport={(s) => console.log('Import:', s)}
    />
  );
}

export const Default: Story = {
  render: () => (
    <DashboardEditorWrapper
      schema={{
        type: 'dashboard',
        name: 'sample-dashboard',
        title: 'Sample Dashboard',
        columns: 2,
        widgets: [],
      }}
    />
  ),
};

export const WithWidgets: Story = {
  render: () => (
    <DashboardEditorWrapper
      schema={{
        type: 'dashboard',
        name: 'sales-dashboard',
        title: 'Sales Dashboard',
        columns: 3,
        widgets: [
          { id: 'w1', title: 'Total Revenue', type: 'metric', layout: { x: 0, y: 0, w: 1, h: 1 } },
          { id: 'w2', title: 'Orders', type: 'metric', layout: { x: 1, y: 0, w: 1, h: 1 } },
          { id: 'w3', title: 'Revenue Trend', type: 'line', layout: { x: 0, y: 1, w: 2, h: 1 } },
          { id: 'w4', title: 'Top Products', type: 'table', layout: { x: 2, y: 0, w: 1, h: 2 } },
        ],
      }}
    />
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <DashboardEditorWrapper
      readOnly
      schema={{
        type: 'dashboard',
        name: 'readonly-dashboard',
        title: 'Read-Only Dashboard',
        columns: 2,
        widgets: [
          { id: 'w-ro', title: 'KPI Metric', type: 'metric', layout: { x: 0, y: 0, w: 1, h: 1 } },
        ],
      }}
    />
  ),
};
