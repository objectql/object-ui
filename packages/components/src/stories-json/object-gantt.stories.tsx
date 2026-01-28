import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Gantt',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
    test: {
       timeout: 60000,
    },
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const ProjectSchedule: Story = {
  render: renderStory,
  args: {
    type: 'object-gantt',
    objectName: 'Task',
    gantt: {
      startDateField: 'startDate',
      endDateField: 'endDate',
      titleField: 'name',
      progressField: 'progress',
      dependenciesField: 'dependencies'
    },
    tasks: [
      {
        id: '1',
        name: 'Project Planning',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        progress: 100
      },
      {
        id: '2',
        name: 'Design Phase',
        startDate: '2024-01-10',
        endDate: '2024-02-15',
        progress: 75,
        dependencies: ['1']
      },
      {
        id: '3',
        name: 'Development',
        startDate: '2024-02-01',
        endDate: '2024-04-30',
        progress: 30,
        dependencies: ['2']
      },
      {
        id: '4',
        name: 'Testing',
        startDate: '2024-04-15',
        endDate: '2024-05-15',
        progress: 0,
        dependencies: ['3']
      }
    ],
    className: 'w-full'
  } as any,
};

export const SimpleGantt: Story = {
  render: renderStory,
  args: {
    type: 'object-gantt',
    objectName: 'Milestone',
    gantt: {
      startDateField: 'start',
      endDateField: 'end',
      titleField: 'title'
    },
    tasks: [
      {
        id: '1',
        title: 'Schema/Plugins/Q1 Goals',
        start: '2024-01-01',
        end: '2024-03-31'
      },
      {
        id: '2',
        title: 'Schema/Plugins/Q2 Goals',
        start: '2024-04-01',
        end: '2024-06-30'
      },
      {
        id: '3',
        title: 'Schema/Plugins/Q3 Goals',
        start: '2024-07-01',
        end: '2024-09-30'
      }
    ],
    className: 'w-full'
  } as any,
};
