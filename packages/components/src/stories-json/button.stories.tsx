import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Actions/Button',
  component: SchemaRenderer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
    type: { control: "text" },
    props: { control: "object" },
    children: { control: "object" }
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    // Treat args as the schema definition
    return <SchemaRenderer schema={args as unknown as BaseSchema} />;
  },
  args: {
    type: 'button',
    props: {
      variant: 'default',
    },
    // Using children array as per spec
    children: [
        {
            type: 'text',
            content: 'Click Me (JSON)'
        }
    ]
  } as any,
};

export const Outline: Story = {
  render: (args) => <SchemaRenderer schema={args as unknown as BaseSchema} />,
  args: {
    type: 'button',
    props: {
      variant: 'outline',
    },
    children: [
        {
            type: 'text',
            content: 'Outline Button'
        }
    ]
  } as any,
};

export const Destructive: Story = {
  render: (args) => <SchemaRenderer schema={args as unknown as BaseSchema} />,
  args: {
    type: 'button',
    props: {
        variant: 'destructive',
    },
    children: [
        {
            type: 'text',
            content: 'Delete'
        }
    ]
  } as any,
};
