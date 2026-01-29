import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';
import { createStorybookDataSource } from '../../../.storybook/datasource';

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

// Create a DataSource instance that connects to MSW
const dataSource = createStorybookDataSource();

const renderStory = (args: any) => (
  <SchemaRendererProvider dataSource={dataSource}>
    <SchemaRenderer schema={args as unknown as BaseSchema} />
  </SchemaRendererProvider>
);

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

/**
 * Contact Form - Uses MSW-backed schema from ObjectStack runtime
 * 
 * This story demonstrates integration with the MSW plugin runtime mode.
 * The form schema is fetched from /api/v1/metadata/contact via the ObjectStack kernel.
 */
export const ContactForm: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'contact',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'company', label: 'Company', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Lead', 'Customer'] }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};

/**
 * Opportunity Form - Uses MSW-backed schema from ObjectStack runtime
 * 
 * This story demonstrates creating/editing opportunity records via MSW runtime.
 */
export const OpportunityForm: Story = {
  render: renderStory,
  args: {
    type: 'object-form',
    objectName: 'opportunity',
    fields: [
      { name: 'name', label: 'Opportunity Name', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'stage', label: 'Stage', type: 'select', options: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] },
      { name: 'closeDate', label: 'Close Date', type: 'date' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 4 }
    ],
    className: 'w-full max-w-2xl'
  } as any,
};
