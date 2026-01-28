import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Display/Calendar',
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

export const CalendarView: Story = {
  render: renderStory,
  args: {
    type: 'calendar-view',
    events: [
      {
        id: '1',
        title: 'Schema/Data Display/Team Meeting',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 15, 10, 0),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 15, 11, 0),
        color: '#3b82f6'
      },
      {
        id: '2',
        title: 'Schema/Data Display/Project Deadline',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 20),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 20),
        allDay: true,
        color: '#ef4444'
      },
      {
        id: '3',
        title: 'Schema/Data Display/Client Presentation',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 25, 14, 0),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 25, 16, 0),
        color: '#10b981'
      }
    ],
    className: 'h-[600px]'
  } as any,
};

export const MonthView: Story = {
  render: renderStory,
  args: {
    type: 'calendar-view',
    defaultView: 'month',
    events: [
      {
        id: '1',
        title: 'Schema/Data Display/Sprint Planning',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1, 9, 0),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 1, 10, 30),
        color: '#8b5cf6'
      },
      {
        id: '2',
        title: 'Schema/Data Display/Code Review',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 5, 15, 0),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 5, 16, 0),
        color: '#3b82f6'
      },
      {
        id: '3',
        title: 'Schema/Data Display/Team Building',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 10),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 10),
        allDay: true,
        color: '#f59e0b'
      }
    ],
    className: 'h-[600px]'
  } as any,
};
