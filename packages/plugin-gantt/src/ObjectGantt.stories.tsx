import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';
import { createStorybookDataSource } from '@storybook-config/datasource';

const meta = {
  title: 'Plugins/ObjectGantt',
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
    type: 'object-gantt',
    objectName: 'Project',
    gantt: {
      startDateField: 'startDate',
      endDateField: 'endDate',
      titleField: 'name',
      progressField: 'progress',
      dependenciesField: 'dependencies',
    },
    tasks: [
      {
        id: '1',
        name: 'Requirements Gathering',
        startDate: '2024-01-01',
        endDate: '2024-01-20',
        progress: 100,
      },
      {
        id: '2',
        name: 'System Design',
        startDate: '2024-01-15',
        endDate: '2024-02-10',
        progress: 80,
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Frontend Development',
        startDate: '2024-02-01',
        endDate: '2024-04-15',
        progress: 45,
        dependencies: ['2'],
      },
      {
        id: '4',
        name: 'Backend Development',
        startDate: '2024-02-01',
        endDate: '2024-04-30',
        progress: 35,
        dependencies: ['2'],
      },
      {
        id: '5',
        name: 'QA Testing',
        startDate: '2024-04-15',
        endDate: '2024-05-30',
        progress: 0,
        dependencies: ['3', '4'],
      },
      {
        id: '6',
        name: 'Deployment',
        startDate: '2024-05-25',
        endDate: '2024-06-10',
        progress: 0,
        dependencies: ['5'],
      },
    ],
    className: 'w-full',
  } as any,
};

export const SimpleTimeline: Story = {
  render: renderStory,
  args: {
    type: 'object-gantt',
    objectName: 'Milestone',
    gantt: {
      startDateField: 'start',
      endDateField: 'end',
      titleField: 'title',
    },
    tasks: [
      { id: '1', title: 'Phase 1: Planning', start: '2024-01-01', end: '2024-02-28' },
      { id: '2', title: 'Phase 2: Development', start: '2024-03-01', end: '2024-06-30' },
      { id: '3', title: 'Phase 3: Testing', start: '2024-07-01', end: '2024-08-31' },
      { id: '4', title: 'Phase 4: Launch', start: '2024-09-01', end: '2024-09-30' },
    ],
    className: 'w-full',
  } as any,
};
