import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Object Grid',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const UserGrid: Story = {
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'User',
    columns: [
      { field: 'id', header: 'ID', width: 80 },
      { field: 'name', header: 'Name', sortable: true, filterable: true },
      { field: 'email', header: 'Email', sortable: true, filterable: true },
      { field: 'role', header: 'Role', sortable: true },
      { field: 'status', header: 'Status', sortable: true }
    ],
    data: [
      { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive' }
    ],
    pagination: true,
    pageSize: 10,
    className: 'w-full'
  } as any,
};

export const ProductGrid: Story = {
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Product',
    columns: [
      { field: 'sku', header: 'SKU', width: 120 },
      { field: 'name', header: 'Product Name', sortable: true, filterable: true },
      { field: 'category', header: 'Category', sortable: true, filterable: true },
      { field: 'price', header: 'Price', sortable: true, type: 'currency' },
      { field: 'stock', header: 'In Stock', sortable: true, type: 'number' }
    ],
    data: [
      { sku: 'PROD-001', name: 'Laptop', category: 'Electronics', price: 1299.99, stock: 15 },
      { sku: 'PROD-002', name: 'Mouse', category: 'Electronics', price: 29.99, stock: 120 },
      { sku: 'PROD-003', name: 'Desk Chair', category: 'Furniture', price: 249.99, stock: 8 },
      { sku: 'PROD-004', name: 'Monitor', category: 'Electronics', price: 399.99, stock: 22 }
    ],
    pagination: true,
    pageSize: 5,
    className: 'w-full'
  } as any,
};

export const WithActions: Story = {
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Order',
    columns: [
      { field: 'orderId', header: 'Order ID', width: 120 },
      { field: 'customer', header: 'Customer', sortable: true },
      { field: 'date', header: 'Order Date', sortable: true, type: 'date' },
      { field: 'total', header: 'Total', sortable: true, type: 'currency' },
      { field: 'status', header: 'Status', sortable: true }
    ],
    actions: [
      { label: 'View', action: 'view' },
      { label: 'Edit', action: 'edit' },
      { label: 'Delete', action: 'delete', variant: 'destructive' }
    ],
    data: [
      { orderId: 'ORD-1001', customer: 'Alice Brown', date: '2024-01-15', total: 159.99, status: 'Completed' },
      { orderId: 'ORD-1002', customer: 'Charlie Davis', date: '2024-01-18', total: 89.50, status: 'Processing' },
      { orderId: 'ORD-1003', customer: 'Eve Wilson', date: '2024-01-20', total: 299.99, status: 'Shipped' }
    ],
    pagination: true,
    pageSize: 10,
    className: 'w-full'
  } as any,
};
