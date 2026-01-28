import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Display/Timeline',
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

export const Vertical: Story = {
  render: renderStory,
  args: {
    type: 'timeline',
    variant: 'vertical',
    dateFormat: 'short',
    items: [
      {
        time: '2024-01-15',
        title: 'Schema/Data Display/Project Started',
        description: 'Kickoff meeting and initial planning',
        variant: 'success',
        icon: '🚀',
      },
      {
        time: '2024-02-01',
        title: 'Schema/Data Display/First Milestone',
        description: 'Completed initial design phase',
        variant: 'info',
        icon: '🎨',
      },
      {
        time: '2024-03-15',
        title: 'Schema/Data Display/Beta Release',
        description: 'Released beta version to testers',
        variant: 'warning',
        icon: '⚡',
      },
      {
        time: '2024-04-01',
        title: 'Schema/Data Display/Launch',
        description: 'Official product launch',
        variant: 'success',
        icon: '🎉',
      },
    ]
  } as any,
};

export const Horizontal: Story = {
  render: renderStory,
  args: {
    type: 'timeline',
    variant: 'horizontal',
    dateFormat: 'short',
    items: [
      {
        time: '2024-01-01',
        title: 'Schema/Data Display/Q1',
        description: 'First quarter goals',
        variant: 'default',
      },
      {
        time: '2024-04-01',
        title: 'Schema/Data Display/Q2',
        description: 'Second quarter goals',
        variant: 'info',
      },
      {
        time: '2024-07-01',
        title: 'Schema/Data Display/Q3',
        description: 'Third quarter goals',
        variant: 'warning',
      },
      {
        time: '2024-10-01',
        title: 'Schema/Data Display/Q4',
        description: 'Fourth quarter goals',
        variant: 'success',
      },
    ]
  } as any,
};

export const Gantt: Story = {
  render: renderStory,
  args: {
    type: 'timeline',
    variant: 'gantt',
    dateFormat: 'short',
    timeScale: 'month',
    rowLabel: 'Projects',
    items: [
      {
        label: 'Backend Development',
        items: [
          {
            title: 'Schema/Data Display/API Design',
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            variant: 'success',
          },
          {
            title: 'Schema/Data Display/Implementation',
            startDate: '2024-02-01',
            endDate: '2024-03-31',
            variant: 'info',
          },
        ],
      },
      {
        label: 'Frontend Development',
        items: [
          {
            title: 'Schema/Data Display/UI Design',
            startDate: '2024-01-15',
            endDate: '2024-02-15',
            variant: 'warning',
          },
          {
            title: 'Schema/Data Display/Component Dev',
            startDate: '2024-02-15',
            endDate: '2024-04-15',
            variant: 'default',
          },
        ],
      },
      {
        label: 'Testing',
        items: [
          {
            title: 'Schema/Data Display/QA Phase',
            startDate: '2024-03-01',
            endDate: '2024-04-30',
            variant: 'danger',
          },
        ],
      },
    ],
    className: 'w-full'
  } as any,
};

export const ProductRoadmap: Story = {
  render: renderStory,
  args: {
    type: 'timeline',
    variant: 'vertical',
    dateFormat: 'long',
    items: [
      {
        time: '2024-01-01',
        title: 'Schema/Data Display/Phase 1: Foundation',
        description: 'Core infrastructure and basic features',
        variant: 'success',
      },
      {
        time: '2024-03-01',
        title: 'Schema/Data Display/Phase 2: Enhancement',
        description: 'Advanced features and integrations',
        variant: 'info',
      },
      {
        time: '2024-06-01',
        title: 'Schema/Data Display/Phase 3: Optimization',
        description: 'Performance improvements and scaling',
        variant: 'warning',
      },
      {
        time: '2024-09-01',
        title: 'Schema/Data Display/Phase 4: Enterprise',
        description: 'Enterprise features and support',
        variant: 'default',
      },
    ]
  } as any,
};
