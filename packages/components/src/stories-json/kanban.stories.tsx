import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Kanban',
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
    type: 'kanban',
    columns: [
      {
        id: 'todo',
        title: 'Schema/Plugins/To Do',
        cards: [
          {
            id: 'card-1',
            title: 'Schema/Plugins/Task 1',
            description: 'This is the first task',
            badges: [
              { label: 'High Priority', variant: 'destructive' },
              { label: 'Feature', variant: 'default' }
            ]
          },
          {
            id: 'card-2',
            title: 'Schema/Plugins/Task 2',
            description: 'This is the second task',
            badges: [
              { label: 'Bug', variant: 'destructive' }
            ]
          }
        ]
      },
      {
        id: 'in-progress',
        title: 'Schema/Plugins/In Progress',
        limit: 3,
        cards: [
          {
            id: 'card-3',
            title: 'Schema/Plugins/Task 3',
            description: 'Currently working on this',
            badges: [
              { label: 'In Progress', variant: 'default' }
            ]
          }
        ]
      },
      {
        id: 'done',
        title: 'Schema/Plugins/Done',
        cards: [
          {
            id: 'card-4',
            title: 'Schema/Plugins/Task 4',
            description: 'This task is completed',
            badges: [
              { label: 'Completed', variant: 'outline' }
            ]
          },
          {
            id: 'card-5',
            title: 'Schema/Plugins/Task 5',
            description: 'Another completed task',
            badges: [
              { label: 'Completed', variant: 'outline' }
            ]
          }
        ]
      }
    ],
    className: 'w-full'
  } as any,
};

export const ProjectManagement: Story = {
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [
      {
        id: 'backlog',
        title: 'Schema/Plugins/Backlog',
        cards: [
          {
            id: 'task-1',
            title: 'Schema/Plugins/Implement dark mode',
            description: 'Add support for dark theme across the application',
            badges: [
              { label: 'Enhancement', variant: 'default' },
              { label: 'Low Priority', variant: 'secondary' }
            ]
          },
          {
            id: 'task-2',
            title: 'Schema/Plugins/Performance optimization',
            description: 'Optimize bundle size and loading time',
            badges: [
              { label: 'Performance', variant: 'default' }
            ]
          }
        ]
      },
      {
        id: 'in-progress',
        title: 'Schema/Plugins/In Progress',
        limit: 2,
        cards: [
          {
            id: 'task-3',
            title: 'Schema/Plugins/User authentication',
            description: 'Implement JWT-based authentication',
            badges: [
              { label: 'Feature', variant: 'default' },
              { label: 'High Priority', variant: 'destructive' }
            ]
          }
        ]
      },
      {
        id: 'review',
        title: 'Schema/Plugins/In Review',
        cards: [
          {
            id: 'task-4',
            title: 'Schema/Plugins/API integration',
            description: 'Connect to REST API endpoints',
            badges: [
              { label: 'Feature', variant: 'default' }
            ]
          }
        ]
      },
      {
        id: 'completed',
        title: 'Schema/Plugins/Completed',
        cards: [
          {
            id: 'task-5',
            title: 'Schema/Plugins/Initial setup',
            description: 'Project scaffolding and configuration',
            badges: [
              { label: 'Done', variant: 'outline' }
            ]
          }
        ]
      }
    ],
    className: 'w-full'
  } as any,
};
