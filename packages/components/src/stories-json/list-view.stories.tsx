import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/ListView',
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

export const ContactsGrid: Story = {
  render: renderStory,
  args: {
    type: 'list-view',
    objectName: 'contacts',
    viewType: 'grid',
    fields: ['name', 'email', 'phone', 'company'],
    sort: [{ field: 'name', order: 'asc' }],
  } as any,
};

export const DealsKanban: Story = {
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

export const TasksCalendar: Story = {
  render: renderStory,
  args: {
    type: 'list-view',
    objectName: 'tasks',
    viewType: 'calendar',
    fields: ['title', 'status', 'priority', 'due_date'],
    options: {
      calendar: {
        startDateField: 'due_date',
        titleField: 'title',
      },
    },
  } as any,
};

export const SalesChart: Story = {
  render: renderStory,
  args: {
    type: 'list-view',
    objectName: 'sales',
    viewType: 'chart',
    fields: ['month', 'revenue', 'profit'],
    options: {
      chart: {
        chartType: 'bar',
        xAxisField: 'month',
        yAxisFields: ['revenue', 'profit'],
      },
    },
  } as any,
};

export const WithFiltersAndSearch: Story = {
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
