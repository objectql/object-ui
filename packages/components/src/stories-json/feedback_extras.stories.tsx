import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Schema/Feedback',
  component: SchemaRenderer,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Spinner: Story = {
    args: {
        type: 'spinner',
        size: 'lg',
        className: 'text-primary'
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const Empty: Story = {
    args: {
        type: 'empty',
        description: 'No Data Found',
        children: [
            { type: 'button', content: 'Create Item', variant: 'default', size: 'sm' }
        ]
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const Loading: Story = {
    args: {
        type: 'loading',
        text: 'Loading your experience...',
        className: 'h-[200px]'
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};
