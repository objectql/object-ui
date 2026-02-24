import type { Meta, StoryObj } from '@storybook/react';
import { PageCanvasEditor } from './PageCanvasEditor';
import type { PageSchema } from '@object-ui/types';
import { useState } from 'react';

const meta = {
  title: 'Designers/PageCanvasEditor',
  component: PageCanvasEditor,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PageCanvasEditor>;

export default meta;
type Story = StoryObj<typeof PageCanvasEditor>;

function PageCanvasEditorWrapper(props: { schema: PageSchema; readOnly?: boolean }) {
  const [schema, setSchema] = useState<PageSchema>(props.schema);
  return (
    <PageCanvasEditor
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
    <PageCanvasEditorWrapper
      schema={{
        type: 'page',
        name: 'sample-page',
        title: 'Sample Page',
        children: [],
      }}
    />
  ),
};

export const WithComponents: Story = {
  render: () => (
    <PageCanvasEditorWrapper
      schema={{
        type: 'page',
        name: 'dashboard-page',
        title: 'Dashboard Page',
        children: [
          { type: 'grid', id: 'grid-1', title: 'Orders Grid' },
          { type: 'kanban', id: 'kanban-1', title: 'Task Board' },
          { type: 'calendar', id: 'cal-1', title: 'Events Calendar' },
        ] as any,
      }}
    />
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <PageCanvasEditorWrapper
      readOnly
      schema={{
        type: 'page',
        name: 'readonly-page',
        title: 'Read-Only Page',
        children: [
          { type: 'grid', id: 'grid-ro', title: 'Data Grid' },
        ] as any,
      }}
    />
  ),
};
