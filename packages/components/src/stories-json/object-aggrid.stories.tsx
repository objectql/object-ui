import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

const meta = {
  title: 'Views/Object Data Grid (ObjectAgGrid)',
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

// Mock data source for demonstration
const createMockDataSource = (objectName: string, data: any[]) => {
  const mockSchema = {
    name: objectName,
    label: objectName.charAt(0).toUpperCase() + objectName.slice(1),
    fields: {} as any
  };

  // Infer fields from data
  if (data.length > 0) {
    const firstRow = data[0];
    Object.keys(firstRow).forEach(key => {
      let type = 'text';
      const value = firstRow[key];
      
      if (typeof value === 'number') type = 'number';
      else if (typeof value === 'boolean') type = 'boolean';
      else if (key.includes('email')) type = 'email';
      else if (key.includes('phone')) type = 'phone';
      else if (key.includes('url') || key.includes('website')) type = 'url';
      else if (key.includes('date')) type = 'date';
      else if (key.includes('price') || key.includes('cost') || key.includes('amount')) type = 'currency';
      else if (key.includes('percent') || key.includes('rate')) type = 'percent';
      
      mockSchema.fields[key] = {
        name: key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        type,
        sortable: true,
        filterable: true
      };
    });
  }

  return {
    find: async () => ({
      data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      hasMore: false
    }),
    getObjectSchema: async () => mockSchema
  };
};

const contactsData = [
  { 
    id: '1', 
    name: 'John Doe', 
    email: 'john.doe@example.com', 
    phone: '+1-555-0101',
    company: 'Acme Corp',
    status: 'Active',
    created_date: '2024-01-15'
  },
  { 
    id: '2', 
    name: 'Jane Smith', 
    email: 'jane.smith@example.com', 
    phone: '+1-555-0102',
    company: 'Tech Solutions',
    status: 'Active',
    created_date: '2024-01-20'
  },
  { 
    id: '3', 
    name: 'Bob Johnson', 
    email: 'bob.johnson@example.com', 
    phone: '+1-555-0103',
    company: 'Innovate Inc',
    status: 'Inactive',
    created_date: '2024-02-01'
  },
  { 
    id: '4', 
    name: 'Alice Williams', 
    email: 'alice.w@example.com', 
    phone: '+1-555-0104',
    company: 'Creative Studio',
    status: 'Active',
    created_date: '2024-02-10'
  },
  { 
    id: '5', 
    name: 'Charlie Brown', 
    email: 'charlie.b@example.com', 
    phone: '+1-555-0105',
    company: 'Digital Agency',
    status: 'Active',
    created_date: '2024-02-15'
  },
];

const productsData = [
  { 
    id: '1', 
    name: 'Laptop Pro', 
    category: 'Electronics',
    price: 1299.99,
    stock: 45,
    rating: 4.5,
    available: true
  },
  { 
    id: '2', 
    name: 'Wireless Mouse', 
    category: 'Electronics',
    price: 29.99,
    stock: 150,
    rating: 4.2,
    available: true
  },
  { 
    id: '3', 
    name: 'Desk Chair', 
    category: 'Furniture',
    price: 299.99,
    stock: 20,
    rating: 4.8,
    available: true
  },
  { 
    id: '4', 
    name: 'Monitor 27"', 
    category: 'Electronics',
    price: 399.99,
    stock: 35,
    rating: 4.6,
    available: true
  },
  { 
    id: '5', 
    name: 'Keyboard Mechanical', 
    category: 'Electronics',
    price: 149.99,
    stock: 60,
    rating: 4.7,
    available: false
  },
];

export const ContactsGrid: Story = {
  render: renderStory,
  args: {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: createMockDataSource('contacts', contactsData),
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    animateRows: true,
    columnConfig: {
      resizable: true,
      sortable: true,
      filterable: true
    }
  } as any,
};

export const ProductsGrid: Story = {
  render: renderStory,
  args: {
    type: 'object-aggrid',
    objectName: 'products',
    dataSource: createMockDataSource('products', productsData),
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    animateRows: true,
    columnConfig: {
      resizable: true,
      sortable: true,
      filterable: true
    }
  } as any,
};

export const WithFieldSelection: Story = {
  render: renderStory,
  args: {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: createMockDataSource('contacts', contactsData),
    fieldNames: ['name', 'email', 'company', 'status'],
    pagination: true,
    pageSize: 10,
    theme: 'alpine',
    height: 400
  } as any,
};

export const EditableGrid: Story = {
  render: renderStory,
  args: {
    type: 'object-aggrid',
    objectName: 'products',
    dataSource: createMockDataSource('products', productsData),
    editable: true,
    singleClickEdit: true,
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    columnConfig: {
      resizable: true,
      sortable: true,
      filterable: true
    }
  } as any,
};

export const WithExport: Story = {
  render: renderStory,
  args: {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: createMockDataSource('contacts', contactsData),
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    exportConfig: {
      enabled: true,
      fileName: 'contacts-export.csv'
    }
  } as any,
};
