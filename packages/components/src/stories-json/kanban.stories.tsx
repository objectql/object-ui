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

export const WithVirtualScrolling: Story = {
  render: renderStory,
  args: {
    type: 'kanban',
    enableVirtualScrolling: true,
    columns: [
      {
        id: 'backlog',
        title: 'Backlog',
        cards: Array.from({ length: 100 }, (_, i) => ({
          id: `card-${i}`,
          title: `Task ${i + 1}`,
          description: `Description for task ${i + 1}`,
          badges: [
            { label: i % 3 === 0 ? 'Bug' : i % 2 === 0 ? 'Feature' : 'Enhancement', variant: 'default' }
          ]
        }))
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        limit: 5,
        cards: []
      },
      {
        id: 'done',
        title: 'Done',
        cards: []
      }
    ],
    className: 'w-full'
  } as any,
};

export const WithColumnLimits: Story = {
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [
      {
        id: 'todo',
        title: 'To Do',
        cards: [
          { id: '1', title: 'Task 1', badges: [{ label: 'P1', variant: 'destructive' }] },
          { id: '2', title: 'Task 2', badges: [{ label: 'P2', variant: 'default' }] },
        ]
      },
      {
        id: 'in-progress',
        title: 'In Progress (80% Full)',
        limit: 5,
        cards: [
          { id: '3', title: 'Task 3', description: 'Working on this' },
          { id: '4', title: 'Task 4', description: 'Almost done' },
          { id: '5', title: 'Task 5', description: 'In review' },
          { id: '6', title: 'Task 6', description: 'Testing' },
        ]
      },
      {
        id: 'blocked',
        title: 'Blocked (Over Limit)',
        limit: 2,
        cards: [
          { id: '7', title: 'Task 7', description: 'Waiting for API', badges: [{ label: 'Blocked', variant: 'destructive' }] },
          { id: '8', title: 'Task 8', description: 'Dependency issue', badges: [{ label: 'Blocked', variant: 'destructive' }] },
          { id: '9', title: 'Task 9', description: 'Needs approval', badges: [{ label: 'Blocked', variant: 'destructive' }] },
        ]
      },
      {
        id: 'done',
        title: 'Done',
        cards: [
          { id: '10', title: 'Task 10', badges: [{ label: 'Completed', variant: 'outline' }] },
        ]
      }
    ],
    className: 'w-full'
  } as any,
};

export const WithCollapsibleColumns: Story = {
  render: renderStory,
  args: {
    type: 'kanban',
    enableCollapse: true,
    columns: [
      {
        id: 'backlog',
        title: 'Backlog',
        collapsed: false,
        cards: [
          { id: '1', title: 'Feature Request 1', description: 'Add dark mode support' },
          { id: '2', title: 'Feature Request 2', description: 'Export to PDF' },
          { id: '3', title: 'Bug Fix 1', description: 'Fix login issue' },
        ]
      },
      {
        id: 'todo',
        title: 'To Do',
        collapsed: false,
        cards: [
          { id: '4', title: 'Update documentation', badges: [{ label: 'Docs', variant: 'secondary' }] },
          { id: '5', title: 'Write tests', badges: [{ label: 'Testing', variant: 'default' }] },
        ]
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        collapsed: false,
        cards: [
          { id: '6', title: 'Implement API', description: 'RESTful endpoints' },
        ]
      },
      {
        id: 'done',
        title: 'Done',
        collapsed: true,
        cards: [
          { id: '7', title: 'Setup project', badges: [{ label: 'Done', variant: 'outline' }] },
          { id: '8', title: 'Configure CI/CD', badges: [{ label: 'Done', variant: 'outline' }] },
          { id: '9', title: 'Deploy to staging', badges: [{ label: 'Done', variant: 'outline' }] },
        ]
      }
    ],
    className: 'w-full'
  } as any,
};
