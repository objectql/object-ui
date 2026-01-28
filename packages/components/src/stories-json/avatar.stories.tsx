import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Data Display/Avatar',
  component: SchemaRenderer,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } }
  }
} satisfies Meta<typeof SchemaRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'avatar',
    src: 'https://github.com/shadcn.png',
    alt: '@shadcn',
    fallback: 'CN'
  } as any,
};

export const Fallback: Story = {
  render: renderStory,
  args: {
    type: 'avatar',
    src: 'https://broken-link',
    alt: '@shadcn',
    fallback: 'CN'
  } as any,
};
