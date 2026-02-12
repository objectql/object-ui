import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/ListView',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'list-view',
    objectName: 'contacts',
    viewType: 'grid',
    fields: ['name', 'email', 'phone', 'company'],
    sort: [{ field: 'name', order: 'asc' }],
  } as any,
};

export const KanbanView: Story = {
  render: renderStory,
  args: {
    type: 'list-view',
    objectName: 'deals',
    viewType: 'kanban',
    fields: ['name', 'amount', 'stage', 'close_date'],
    options: {
      kanban: {
        groupField: 'stage',
        titleField: 'name',
        cardFields: ['amount', 'close_date'],
      },
    },
  } as any,
};

export const WithFilters: Story = {
  render: renderStory,
  args: {
    type: 'list-view',
    objectName: 'opportunities',
    viewType: 'grid',
    fields: ['name', 'amount', 'stage', 'owner', 'close_date'],
    filters: [
      ['stage', '=', 'Prospecting'],
      'OR',
      ['stage', '=', 'Qualification'],
    ],
    sort: [{ field: 'amount', order: 'desc' }],
  } as any,
};
