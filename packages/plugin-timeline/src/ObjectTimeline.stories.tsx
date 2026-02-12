import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/ObjectTimeline',
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
    type: 'timeline',
    variant: 'vertical',
    dateFormat: 'short',
    items: [
      {
        time: '2024-01-10',
        title: 'Project Kickoff',
        description: 'Initial planning and team formation',
        variant: 'success',
        icon: '🚀',
      },
      {
        time: '2024-02-15',
        title: 'Alpha Release',
        description: 'Internal alpha build delivered',
        variant: 'info',
        icon: '📦',
      },
      {
        time: '2024-03-20',
        title: 'Beta Launch',
        description: 'Public beta opened to early adopters',
        variant: 'warning',
        icon: '⚡',
      },
      {
        time: '2024-05-01',
        title: 'General Availability',
        description: 'Official public release',
        variant: 'success',
        icon: '🎉',
      },
    ],
  } as any,
};

export const Horizontal: Story = {
  render: renderStory,
  args: {
    type: 'timeline',
    variant: 'horizontal',
    dateFormat: 'short',
    items: [
      { time: '2024-01-01', title: 'Q1', description: 'Foundation phase', variant: 'default' },
      { time: '2024-04-01', title: 'Q2', description: 'Growth phase', variant: 'info' },
      { time: '2024-07-01', title: 'Q3', description: 'Scale phase', variant: 'warning' },
      { time: '2024-10-01', title: 'Q4', description: 'Optimization phase', variant: 'success' },
    ],
  } as any,
};

export const ActivityFeed: Story = {
  render: renderStory,
  args: {
    type: 'timeline',
    variant: 'vertical',
    dateFormat: 'long',
    items: [
      {
        time: '2024-03-15T14:30:00',
        title: 'Deal Updated',
        description: 'Stage changed from Proposal to Negotiation',
        variant: 'info',
        icon: '📝',
      },
      {
        time: '2024-03-14T10:00:00',
        title: 'Meeting Logged',
        description: 'Product demo with stakeholders',
        variant: 'default',
        icon: '📅',
      },
      {
        time: '2024-03-12T16:45:00',
        title: 'Email Sent',
        description: 'Follow-up proposal sent to client',
        variant: 'default',
        icon: '📧',
      },
      {
        time: '2024-03-10T09:00:00',
        title: 'Deal Created',
        description: 'New opportunity worth $150,000',
        variant: 'success',
        icon: '✨',
      },
    ],
  } as any,
};
