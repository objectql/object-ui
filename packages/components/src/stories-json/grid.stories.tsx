import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const JSONRenderer = (args: BaseSchema) => <SchemaRenderer schema={args} />;

const meta = {
  title: 'Layout/Grid (JSON)',
  component: JSONRenderer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof JSONRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoColumns: Story = {
  args: {
    type: 'grid',
    props: {
      cols: 2,
      gap: 4
    },
    children: [
        { type: 'card', className: 'p-4 bg-muted', content: 'Column 1' },
        { type: 'card', className: 'p-4 bg-muted', content: 'Column 2' },
        { type: 'card', className: 'p-4 bg-muted', content: 'Column 3' },
        { type: 'card', className: 'p-4 bg-muted', content: 'Column 4' }
    ]
  },
};

export const Responsive: Story = {
    args: {
      type: 'grid',
      props: {
        cols: {
            base: 1,
            md: 2,
            lg: 4
        },
        gap: 4
      },
      children: [
          { type: 'card', className: 'p-4 bg-red-100', content: '1' },
          { type: 'card', className: 'p-4 bg-blue-100', content: '2' },
          { type: 'card', className: 'p-4 bg-green-100', content: '3' },
          { type: 'card', className: 'p-4 bg-yellow-100', content: '4' }
      ]
    },
  };
