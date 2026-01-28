import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Object Form',
  component: SchemaRenderer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const BasicSchema: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'User',
    fields: [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'age', label: 'Age', type: 'number' }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};

export const WithSections: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'Employee',
    sections: [
      {
        title: 'Schema/Plugins/Personal Information',
        fields: [
          { name: 'firstName', label: 'First Name', type: 'text', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' }
        ]
      },
      {
        title: 'Schema/Plugins/Contact Details',
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'address', label: 'Address', type: 'textarea' }
        ]
      }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};

export const ComplexFields: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'Product',
    fields: [
      { name: 'name', label: 'Product Name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Electronics', 'Clothing', 'Food'], required: true },
      { name: 'price', label: 'Price', type: 'number', required: true },
      { name: 'inStock', label: 'In Stock', type: 'checkbox' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 4 }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};
