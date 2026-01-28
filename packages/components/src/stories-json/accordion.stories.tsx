import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Disclosure/Accordion',
  component: SchemaRenderer,
  parameters: { layout: 'padded' },
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
    type: 'accordion',
    className: 'w-[400px]',
    items: [
        { 
            label: 'Is it accessible?', 
            value: 'item-1', 
            content: [{ type: 'text', content: 'Yes. It adheres to the WAI-ARIA design pattern.' }]
        },
        { 
            label: 'Is it styled?', 
            value: 'item-2', 
            content: [{ type: 'text', content: 'Yes. It comes with default styles that matches the other components\' aesthetic.' }]
        },
        { 
            label: 'Is it animated?', 
            value: 'item-3', 
            content: [{ type: 'text', content: 'Yes. It\'s animated by default, but you can disable it if you prefer.' }]
        }
    ]
  } as any,
};
