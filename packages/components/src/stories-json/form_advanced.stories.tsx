import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Schema/Inputs',
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

export const RadioGroup: Story = {
  render: renderStory,
  args: {
    type: 'radio-group',
    defaultValue: 'option-one',
    id: 'r1',
    options: [
        { label: 'Option One', value: 'option-one' },
        { label: 'Option Two', value: 'option-two' },
        { label: 'Option Three', value: 'option-three' }
    ]
  } as any,
};

export const Slider: Story = {
  render: renderStory,
  args: {
    type: 'slider',
    defaultValue: [33],
    max: 100,
    step: 1,
    className: 'w-[300px]'
  } as any,
};

export const InputOTP: Story = {
  render: renderStory,
  args: {
    type: 'input-otp',
    maxLength: 6,
    value: "123"
  } as any,
};

export const Combobox: Story = {
  render: renderStory,
  args: {
    type: 'combobox',
    placeholder: 'Select framework...',
    className: 'w-[300px]',
    options: [
        { label: 'Next.js', value: 'next.js' },
        { label: 'SvelteKit', value: 'sveltekit' },
        { label: 'Nuxt.js', value: 'nuxt.js' },
        { label: 'Remix', value: 'remix' },
        { label: 'Astro', value: 'astro' }
    ]
  } as any,
};
