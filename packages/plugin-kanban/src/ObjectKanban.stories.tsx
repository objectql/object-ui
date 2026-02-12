import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/ObjectKanban',
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
        title: 'To Do',
        cards: [
          {
            id: 'card-1',
            title: 'Design homepage',
            description: 'Create wireframes and mockups',
            badges: [{ label: 'Design', variant: 'default' }],
          },
          {
            id: 'card-2',
            title: 'Setup CI pipeline',
            description: 'Configure GitHub Actions',
            badges: [{ label: 'DevOps', variant: 'secondary' }],
          },
        ],
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        limit: 3,
        cards: [
          {
            id: 'card-3',
            title: 'Implement auth',
            description: 'JWT-based authentication flow',
            badges: [
              { label: 'Feature', variant: 'default' },
              { label: 'High Priority', variant: 'destructive' },
            ],
          },
        ],
      },
      {
        id: 'done',
        title: 'Done',
        cards: [
          {
            id: 'card-4',
            title: 'Project scaffolding',
            description: 'Initial project setup completed',
            badges: [{ label: 'Completed', variant: 'outline' }],
          },
        ],
      },
    ],
    className: 'w-full',
  } as any,
};

export const SprintBoard: Story = {
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [
      {
        id: 'backlog',
        title: 'Backlog',
        cards: [
          { id: 's-1', title: 'Refactor API layer', description: 'Improve error handling', badges: [{ label: 'Tech Debt', variant: 'secondary' }] },
          { id: 's-2', title: 'Add unit tests', description: 'Increase coverage to 80%', badges: [{ label: 'Testing', variant: 'default' }] },
        ],
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        limit: 2,
        cards: [
          { id: 's-3', title: 'User dashboard', description: 'Build analytics dashboard', badges: [{ label: 'Feature', variant: 'default' }, { label: 'P1', variant: 'destructive' }] },
        ],
      },
      {
        id: 'review',
        title: 'In Review',
        cards: [
          { id: 's-4', title: 'Search functionality', description: 'Full-text search implementation', badges: [{ label: 'Feature', variant: 'default' }] },
        ],
      },
      {
        id: 'done',
        title: 'Done',
        cards: [
          { id: 's-5', title: 'Login page', badges: [{ label: 'Done', variant: 'outline' }] },
          { id: 's-6', title: 'Database schema', badges: [{ label: 'Done', variant: 'outline' }] },
        ],
      },
    ],
    className: 'w-full',
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
          { id: 'l-1', title: 'Task A', badges: [{ label: 'P1', variant: 'destructive' }] },
          { id: 'l-2', title: 'Task B', badges: [{ label: 'P2', variant: 'default' }] },
        ],
      },
      {
        id: 'wip',
        title: 'WIP (Over Limit)',
        limit: 2,
        cards: [
          { id: 'l-3', title: 'Task C', description: 'Almost done' },
          { id: 'l-4', title: 'Task D', description: 'In review' },
          { id: 'l-5', title: 'Task E', description: 'Blocked', badges: [{ label: 'Blocked', variant: 'destructive' }] },
        ],
      },
      {
        id: 'done',
        title: 'Done',
        cards: [
          { id: 'l-6', title: 'Task F', badges: [{ label: 'Completed', variant: 'outline' }] },
        ],
      },
    ],
    className: 'w-full',
  } as any,
};
