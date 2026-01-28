import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const JSONRenderer = (args: BaseSchema) => <SchemaRenderer schema={args} />;

const meta = {
  title: 'Basic/Card (JSON)',
  component: JSONRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    type: { control: false },
    props: { control: 'object' },
    children: { control: 'object' },
  },
} satisfies Meta<typeof JSONRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'card',
    className: "w-[350px]",
    children: [
        {
            type: 'card-header',
            children: [
                { type: 'card-title', content: 'Create Project' },
                { type: 'card-description', content: 'Deploy your new project in one-click.' }
            ]
        },
        {
            type: 'card-content',
            children: [
                { 
                    type: 'div', 
                    className: 'flex flex-col space-y-1.5',
                    children: [
                        { type: 'label', content: 'Name', props: { htmlFor: 'name' } },
                        { type: 'input', props: { id: 'name', placeholder: 'Name of your project' } }
                    ]
                }
            ]
        },
        {
            type: 'card-footer',
            className: 'flex justify-between',
            children: [
                { type: 'button', props: { variant: 'outline' }, content: 'Cancel' },
                { type: 'button', content: 'Deploy' }
            ]
        }
    ]
  },
};
