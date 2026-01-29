import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Object View',
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

const renderStory = (args: any) => (
  <SchemaRendererProvider dataSource={{}}>
    <SchemaRenderer schema={args as unknown as BaseSchema} />
  </SchemaRendererProvider>
);

export const UserProfile: Story = {
  render: renderStory,
  args: {
    type: 'object-view',
    objectName: 'User',
    layout: 'card',
    data: {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'Administrator',
      status: 'Active',
      joinedDate: '2023-01-15',
      department: 'Engineering'
    },
    fields: [
      { name: 'id', label: 'User ID', type: 'text' },
      { name: 'name', label: 'Full Name', type: 'text' },
      { name: 'email', label: 'Email Address', type: 'email' },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'status', label: 'Status', type: 'badge' },
      { name: 'joinedDate', label: 'Joined Date', type: 'date' },
      { name: 'department', label: 'Department', type: 'text' }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};

export const ProductDetails: Story = {
  render: renderStory,
  args: {
    type: 'object-view',
    objectName: 'Product',
    layout: 'table',
    data: {
      sku: 'PROD-12345',
      name: 'Professional Laptop',
      category: 'Electronics',
      brand: 'TechCorp',
      price: 1299.99,
      stock: 45,
      description: 'High-performance laptop for professionals',
      rating: 4.5,
      reviews: 128
    },
    fields: [
      { name: 'sku', label: 'SKU', type: 'text' },
      { name: 'name', label: 'Product Name', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'brand', label: 'Brand', type: 'text' },
      { name: 'price', label: 'Price', type: 'currency' },
      { name: 'stock', label: 'In Stock', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'rating', label: 'Rating', type: 'number' },
      { name: 'reviews', label: 'Reviews', type: 'number' }
    ],
    className: 'w-full max-w-3xl'
  } as any,
};

export const OrderSummary: Story = {
  render: renderStory,
  args: {
    type: 'object-view',
    objectName: 'Order',
    layout: 'card',
    data: {
      orderId: 'ORD-98765',
      customer: 'Alice Johnson',
      orderDate: '2024-01-20',
      total: 456.78,
      status: 'Processing',
      shippingAddress: '456 Oak Street, San Francisco, CA 94102',
      items: 3,
      trackingNumber: 'TRK123456789'
    },
    fields: [
      { name: 'orderId', label: 'Order ID', type: 'text' },
      { name: 'customer', label: 'Customer Name', type: 'text' },
      { name: 'orderDate', label: 'Order Date', type: 'date' },
      { name: 'total', label: 'Total Amount', type: 'currency' },
      { name: 'status', label: 'Status', type: 'badge' },
      { name: 'shippingAddress', label: 'Shipping Address', type: 'textarea' },
      { name: 'items', label: 'Number of Items', type: 'number' },
      { name: 'trackingNumber', label: 'Tracking Number', type: 'text' }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};
