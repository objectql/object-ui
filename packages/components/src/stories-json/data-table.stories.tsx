import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Primitives/Display/Table',
  component: SchemaRenderer,
  tags: ['autodocs'],
  argTypes: {
    // Schema properties
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const DataTable: Story = {
  args: {
    type: 'data-table',
    caption: 'Employees',
    columns: [
        { header: 'ID', accessorKey: 'id', width: '80px' },
        { header: 'Name', accessorKey: 'name' },
        { header: 'Email', accessorKey: 'email' },
        { header: 'Role', accessorKey: 'role' },
    ],
    data: [
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const FullFeatures: Story = {
    args: {
      type: 'data-table',
      caption: 'Full Feature Table',
      searchable: true,
      pagination: true,
      selectable: true,
      sortable: true,
      exportable: true,
      rowActions: true,
      pageSize: 5,
      columns: [
          { header: 'Invoice', accessorKey: 'invoice' },
          { header: 'Status', accessorKey: 'status' },
          { header: 'Amount', accessorKey: 'amount', enableSorting: true },
          { header: 'Method', accessorKey: 'method' }
      ],
      data: Array.from({ length: 20 }).map((_, i) => ({
          invoice: `INV-${1000 + i}`,
          status: i % 3 === 0 ? 'Paid' : 'Pending',
          amount: `$${(Math.random() * 500).toFixed(2)}`,
          method: i % 2 === 0 ? 'Credit Card' : 'PayPal'
      }))
    },
    render: (args) => <SchemaRenderer schema={args} />
  };
