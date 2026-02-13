import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/ObjectKanban/Edge Cases',
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

// ── Empty Board ───────────────────────────────────────────────

export const EmptyBoard: Story = {
  name: 'Empty Board – No Columns',
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [],
    className: 'w-full',
  } as any,
};

// ── Columns With No Cards ─────────────────────────────────────

export const ColumnsWithNoCards: Story = {
  name: 'Columns With No Cards',
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [
      { id: 'todo', title: 'To Do', cards: [] },
      { id: 'in-progress', title: 'In Progress', cards: [] },
      { id: 'done', title: 'Done', cards: [] },
    ],
    className: 'w-full',
  } as any,
};

// ── Column At WIP Limit ───────────────────────────────────────

export const ColumnAtWipLimit: Story = {
  name: 'Column At WIP Limit',
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [
      {
        id: 'todo',
        title: 'To Do',
        cards: [
          { id: 'c-1', title: 'Plan sprint', badges: [{ label: 'Planning', variant: 'default' }] },
        ],
      },
      {
        id: 'wip',
        title: 'In Progress (At Limit)',
        limit: 3,
        cards: [
          { id: 'c-2', title: 'Build auth module', description: 'JWT implementation', badges: [{ label: 'Feature', variant: 'default' }] },
          { id: 'c-3', title: 'Write unit tests', description: 'Coverage > 80%', badges: [{ label: 'Testing', variant: 'secondary' }] },
          { id: 'c-4', title: 'Deploy staging', description: 'Push to staging env', badges: [{ label: 'DevOps', variant: 'secondary' }] },
        ],
      },
      {
        id: 'done',
        title: 'Done',
        cards: [
          { id: 'c-5', title: 'Setup repo', badges: [{ label: 'Completed', variant: 'outline' }] },
        ],
      },
    ],
    className: 'w-full',
  } as any,
};

// ── Cards With Very Long Titles ───────────────────────────────

export const CardsWithLongTitles: Story = {
  name: 'Cards With Very Long Titles',
  render: renderStory,
  args: {
    type: 'kanban',
    columns: [
      {
        id: 'backlog',
        title: 'Backlog',
        cards: [
          {
            id: 'long-1',
            title: 'Investigate the root cause of the intermittent timeout errors occurring in the payment processing pipeline during peak traffic hours on weekends',
            description: 'This card has an extremely long title to test text wrapping and overflow behaviour within kanban cards.',
            badges: [
              { label: 'Bug', variant: 'destructive' },
              { label: 'P0 – Critical Production Incident', variant: 'destructive' },
            ],
          },
          {
            id: 'long-2',
            title: 'Refactor the legacy monolithic authentication service into a set of microservices following domain-driven design principles and ensuring backward compatibility',
            badges: [{ label: 'Tech Debt', variant: 'secondary' }],
          },
        ],
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        cards: [
          {
            id: 'long-3',
            title: 'A short title for contrast',
            description: 'Normal-length description.',
          },
        ],
      },
    ],
    className: 'w-full',
  } as any,
};

// ── Many Columns (10+) ───────────────────────────────────────

export const ManyColumns: Story = {
  name: 'Many Columns (10+)',
  render: renderStory,
  args: {
    type: 'kanban',
    columns: Array.from({ length: 12 }, (_, i) => ({
      id: `col-${i + 1}`,
      title: `Stage ${i + 1}`,
      limit: i === 3 ? 2 : undefined,
      cards: i % 3 === 0
        ? [
            {
              id: `mc-${i}-1`,
              title: `Task ${i * 2 + 1}`,
              description: `Description for task in stage ${i + 1}`,
              badges: [{ label: `S${i + 1}`, variant: 'default' as const }],
            },
            {
              id: `mc-${i}-2`,
              title: `Task ${i * 2 + 2}`,
              badges: [{ label: 'Active', variant: 'secondary' as const }],
            },
          ]
        : i % 3 === 1
          ? [
              {
                id: `mc-${i}-1`,
                title: `Task ${i * 2 + 1}`,
                badges: [{ label: 'Review', variant: 'outline' as const }],
              },
            ]
          : [],
    })),
    className: 'w-full',
  } as any,
};
