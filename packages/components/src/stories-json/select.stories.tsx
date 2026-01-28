import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Forms/Select',
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

export const Select: Story = {
  render: renderStory,
  args: {
    type: 'select',
    label: 'Framework',
    placeholder: 'Select a framework',
    wrapperClass: 'w-[280px]',
    options: [
        { label: 'Next.js', value: 'next' },
        { label: 'SvelteKit', value: 'svelte' },
        { label: 'Astro', value: 'astro' },
        { label: 'Nuxt', value: 'nuxt' }
    ]
  } as any,
};
