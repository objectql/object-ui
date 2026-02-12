import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';
import { createStorybookDataSource } from '@storybook-config/datasource';

const meta = {
  title: 'Plugins/ObjectForm',
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

const dataSource = createStorybookDataSource();

const renderStory = (args: any) => (
  <SchemaRendererProvider dataSource={dataSource}>
    <SchemaRenderer schema={args as unknown as BaseSchema} />
  </SchemaRendererProvider>
);

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'Contact',
    customFields: [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
    ],
    className: 'w-full max-w-2xl',
  } as any,
};

export const WithSections: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'Employee',
    sections: [
      {
        title: 'Personal Information',
        fields: [
          { name: 'firstName', label: 'First Name', type: 'text', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
        ],
      },
      {
        title: 'Work Details',
        fields: [
          { name: 'department', label: 'Department', type: 'select', options: ['Engineering', 'Marketing', 'Sales', 'HR'] },
          { name: 'role', label: 'Role', type: 'text' },
          { name: 'startDate', label: 'Start Date', type: 'date' },
        ],
      },
    ],
    className: 'w-full max-w-2xl',
  } as any,
};

export const ComplexFields: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'Product',
    customFields: [
      { name: 'name', label: 'Product Name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Electronics', 'Clothing', 'Food', 'Books'], required: true },
      { name: 'price', label: 'Price', type: 'number', required: true },
      { name: 'inStock', label: 'In Stock', type: 'checkbox' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
    ],
    className: 'w-full max-w-2xl',
  } as any,
};
