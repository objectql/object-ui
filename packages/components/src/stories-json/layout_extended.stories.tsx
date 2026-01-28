import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Layout/Extended',
  component: SchemaRenderer,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ScrollArea: Story = {
    args: {
        type: 'scroll-area',
        height: '200px',
        width: '350px',
        className: 'rounded-md border p-4',
        content: [
            { type: 'div', className: 'mb-4 text-sm font-bold', children: [{ type: 'text', content: 'Tags' }] },
            { 
               type: 'div', 
               children: Array.from({ length: 50 }).map((_, i) => ({
                   type: 'div',
                   className: 'text-sm border-b py-2',
                   children: [{ type: 'text', content: `Tag ${i + 1}` }]
               }))
            }
        ]
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const HeaderBar: Story = {
    args: {
        type: 'header-bar',
        crumbs: [
            { label: 'Application' },
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Analytics' }
        ]
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const Pagination: Story = {
    args: {
        type: 'pagination',
        currentPage: 2,
        totalPages: 10,
        className: 'mt-4'
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};

export const Image: Story = {
    args: {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1576075796615-2c1185331f36?w=800&dpr=2&q=80',
        alt: 'Photo by Unsplash',
        className: 'rounded-xl object-cover',
        width: 300,
        height: 200
    } as any,
    render: (args) => <SchemaRenderer schema={args} />
};
