import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';
import { createStorybookDataSource } from '@storybook-config/datasource';

const meta = {
  title: 'Plugins/ObjectCalendar',
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

const dataSource = createStorybookDataSource();

const renderStory = (args: any) => (
  <SchemaRendererProvider dataSource={dataSource}>
    <SchemaRenderer schema={args as unknown as BaseSchema} />
  </SchemaRendererProvider>
);

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Event',
    viewType: 'calendar',
    calendar: {
      startDateField: 'startDate',
      endDateField: 'endDate',
      titleField: 'title',
    },
    columns: [
      { field: 'title', header: 'Title' },
      { field: 'startDate', header: 'Start Date' },
      { field: 'endDate', header: 'End Date' },
      { field: 'category', header: 'Category' },
    ],
    data: [
      { id: 1, title: 'Team Standup', startDate: '2024-03-04T09:00:00', endDate: '2024-03-04T09:30:00', category: 'Meeting' },
      { id: 2, title: 'Sprint Planning', startDate: '2024-03-05T10:00:00', endDate: '2024-03-05T12:00:00', category: 'Meeting' },
      { id: 3, title: 'Design Review', startDate: '2024-03-06T14:00:00', endDate: '2024-03-06T15:00:00', category: 'Review' },
      { id: 4, title: 'Product Demo', startDate: '2024-03-07T16:00:00', endDate: '2024-03-07T17:00:00', category: 'Demo' },
      { id: 5, title: 'Retrospective', startDate: '2024-03-08T11:00:00', endDate: '2024-03-08T12:00:00', category: 'Meeting' },
    ],
    className: 'w-full',
  } as any,
};

export const MonthlyEvents: Story = {
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Appointment',
    viewType: 'calendar',
    calendar: {
      startDateField: 'date',
      titleField: 'name',
    },
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'date', header: 'Date' },
      { field: 'type', header: 'Type' },
    ],
    data: [
      { id: 1, name: 'Board Meeting', date: '2024-03-01T10:00:00', type: 'Corporate' },
      { id: 2, name: 'Client Call', date: '2024-03-05T14:00:00', type: 'Sales' },
      { id: 3, name: 'Team Lunch', date: '2024-03-12T12:00:00', type: 'Social' },
      { id: 4, name: 'Quarterly Review', date: '2024-03-15T09:00:00', type: 'Corporate' },
      { id: 5, name: 'Workshop', date: '2024-03-20T13:00:00', type: 'Training' },
      { id: 6, name: 'Release Day', date: '2024-03-25T08:00:00', type: 'Engineering' },
    ],
    className: 'w-full',
  } as any,
};
