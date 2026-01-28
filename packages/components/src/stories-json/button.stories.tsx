import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

// Wrapper component to render JSON schema
const JSONRenderer = (args: BaseSchema) => {
  return <SchemaRenderer schema={args} />;
};

const meta = {
  title: 'Basic/Button (JSON)',
  component: JSONRenderer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: { control: false },
    props: { control: 'object' },
    children: { control: "object", table: { type: { summary: "object" } } },
  },
} satisfies Meta<typeof JSONRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'button',
    props: {
      variant: 'default',
    },
    children: [
        {
            type: 'text',
            content: 'Click Me (JSON)'
        }
    ]
  },
};

export const Outline: Story = {
    args: {
      type: 'button',
      props: {
        variant: 'outline',
      },
      children: [
          {
              type: 'text',
              content: 'Outline'
          }
      ]
    },
  };
