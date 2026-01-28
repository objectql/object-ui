import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Layout/Card',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
    children: { control: "object" }
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Card: Story = {
  render: renderStory,
  args: {
    type: 'card',
    className: "w-[350px]",
    // Using high-level props supported by CardRenderer
    title: 'Schema/Layout/Create Project',
    description: "Deploy your new project in one-click.",
    // Main content (wrapped in CardContent by renderer)
    children: [
        { 
            type: 'div', 
            className: 'flex flex-col space-y-1.5',
            children: [
                { type: 'label', content: 'Name', props: { htmlFor: 'name' } },
                { type: 'input', props: { id: 'name', placeholder: 'Name of your project' } }
            ]
        }
    ],
    // Footer content
    footer: [
        { type: 'button', props: { variant: 'outline' }, children: [{type:'text', content: 'Cancel'}] },
        { type: 'button', children: [{type: 'text', content: 'Deploy'}] }
    ]
  } as any,
};
