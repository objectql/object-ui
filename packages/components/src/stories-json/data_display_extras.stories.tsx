import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Schema/Data Display',
  component: SchemaRenderer,
  tags: ['autodocs'],
  argTypes: {
    // Schema properties
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardKey: Story = {
  args: {
    type: 'kbd',
    keys: ['⌘', 'K'],
    className: 'text-xs'
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const ListUnordered: Story = {
  args: {
    type: 'list',
    title: 'Schema/Data Display/Technology Stack',
    ordered: false,
    items: [
        'React',
        'TypeScript',
        'Tailwind CSS',
        { content: 'Storybook', className: 'font-bold' }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const ListOrdered: Story = {
  args: {
    type: 'list',
    title: 'Schema/Data Display/Installation Steps',
    ordered: true,
    items: [
        'Run npm install',
        'Configure provider',
        'Start application'
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const SimpleTable: Story = {
  args: {
    type: 'table',
    bind: 'users',
    columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' }
    ]
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        {/* Mock data context would be needed here, but since stories don't have easy data injection without a provider, 
            we rely on the renderer handling undefined/empty data gracefully, or we wrap it in a provider if available using decorators.
            However, SchemaRenderer doesn't accept a provider prop directly. 
            The users will see "Table data must be an array" or Empty state.
            Hack: We can't easily inject data into the unified SchemaRenderer story pattern without a wrapping provider in the story.
         */}
         <Story />
      </div>
    )
  ],
  render: (args) => <SchemaRenderer schema={args} />
};

export const TreeView: Story = {
  args: {
    type: 'tree-view',
    title: 'Schema/Data Display/Project Files',
    nodes: [
        {
          id: 'src',
          label: 'src',
          icon: 'folder',
          children: [
             { id: 'components', label: 'components', icon: 'folder', children: [{id: 'Button.tsx', label: 'Button.tsx', icon: 'file'}] },
             { id: 'App.tsx', label: 'App.tsx', icon: 'file' }
          ]
        },
        {
          id: 'package.json',
          label: 'package.json',
          icon: 'file'
        }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};
