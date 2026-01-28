import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Basic/Navigation Menu',
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
    type: 'navigation-menu',
    items: [
        { label: 'Home', href: '#' },
        { 
            label: 'Products', 
            children: [
                { label: 'Analytics', description: 'Get insights into who is clicking your links', href: '#' },
                { label: 'Engagement', description: 'Measure active engagement with your brand', href: '#' },
                { label: 'Security', description: 'Advanced security features', href: '#' }
            ]
        },
        { label: 'Pricing', href: '#' }
    ]
  } as any,
};
