import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/DetailView',
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

export const ContactDetail: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Contact Details',
    data: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      company: 'Acme Corporation',
      title: 'Senior Developer',
      department: 'Engineering',
    },
    fields: [
      { name: 'name', label: 'Full Name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'company', label: 'Company' },
      { name: 'title', label: 'Job Title' },
      { name: 'department', label: 'Department' },
    ],
    showBack: true,
    showEdit: true,
    showDelete: true,
  } as any,
};

export const WithSections: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Account: Acme Corporation',
    data: {
      name: 'Acme Corporation',
      industry: 'Technology',
      website: 'https://acme.com',
      employees: '500-1000',
      revenue: '$50M - $100M',
      street: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipcode: '94102',
      country: 'USA',
      description: 'Leading technology solutions provider',
    },
    sections: [
      {
        title: 'Basic Information',
        icon: '📋',
        fields: [
          { name: 'name', label: 'Account Name' },
          { name: 'industry', label: 'Industry' },
          { name: 'website', label: 'Website' },
          { name: 'employees', label: 'Employees' },
          { name: 'revenue', label: 'Annual Revenue' },
        ],
        columns: 2,
      },
      {
        title: 'Address',
        icon: '📍',
        collapsible: true,
        defaultCollapsed: false,
        fields: [
          { name: 'street', label: 'Street' },
          { name: 'city', label: 'City' },
          { name: 'state', label: 'State' },
          { name: 'zipcode', label: 'Zip Code' },
          { name: 'country', label: 'Country' },
        ],
        columns: 2,
      },
      {
        title: 'Additional Information',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          { name: 'description', label: 'Description' },
        ],
        columns: 1,
      },
    ],
    showBack: true,
    showEdit: true,
    showDelete: true,
  } as any,
};

export const WithTabs: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Opportunity: Q1 Enterprise Deal',
    data: {
      name: 'Q1 Enterprise Deal',
      amount: '$250,000',
      stage: 'Proposal',
      probability: '75%',
      close_date: '2024-03-31',
    },
    fields: [
      { name: 'name', label: 'Opportunity Name' },
      { name: 'amount', label: 'Amount' },
      { name: 'stage', label: 'Stage' },
      { name: 'probability', label: 'Probability' },
      { name: 'close_date', label: 'Close Date' },
    ],
    tabs: [
      {
        key: 'details',
        label: 'Details',
        icon: '📄',
        content: {
          type: 'box',
          children: [
            {
              type: 'text',
              text: 'Detailed opportunity information goes here...',
            },
          ],
        },
      },
      {
        key: 'activity',
        label: 'Activity',
        icon: '📊',
        badge: '12',
        content: {
          type: 'box',
          children: [
            {
              type: 'text',
              text: 'Activity timeline and history...',
            },
          ],
        },
      },
      {
        key: 'notes',
        label: 'Notes',
        icon: '📝',
        content: {
          type: 'box',
          children: [
            {
              type: 'text',
              text: 'Internal notes and comments...',
            },
          ],
        },
      },
    ],
    showBack: true,
    showEdit: true,
    showDelete: true,
  } as any,
};

export const WithRelatedLists: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Account: Acme Corporation',
    objectName: 'accounts',
    resourceId: '12345',
    data: {
      name: 'Acme Corporation',
      industry: 'Technology',
    },
    fields: [
      { name: 'name', label: 'Account Name' },
      { name: 'industry', label: 'Industry' },
    ],
    related: [
      {
        title: 'Contacts',
        type: 'table',
        data: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@acme.com',
            phone: '+1 555-0001',
            title: 'CEO',
          },
          {
            id: '2',
            name: 'Jane Smith',
            email: 'jane@acme.com',
            phone: '+1 555-0002',
            title: 'CTO',
          },
        ],
        columns: ['name', 'email', 'phone', 'title'],
      },
      {
        title: 'Opportunities',
        type: 'table',
        data: [
          {
            id: '1',
            name: 'Q1 Deal',
            amount: '$250,000',
            stage: 'Proposal',
            close_date: '2024-03-31',
          },
          {
            id: '2',
            name: 'Q2 Expansion',
            amount: '$100,000',
            stage: 'Prospecting',
            close_date: '2024-06-30',
          },
        ],
        columns: ['name', 'amount', 'stage', 'close_date'],
      },
    ],
    showBack: true,
    showEdit: true,
    showDelete: true,
  } as any,
};

export const LoadingState: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Loading...',
    loading: true,
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
    ],
    showBack: true,
  } as any,
};
