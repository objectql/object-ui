import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Plugins/DetailView',
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

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Employee Details',
    data: {
      name: 'Sarah Connor',
      email: 'sarah.connor@example.com',
      phone: '+1 (555) 867-5309',
      department: 'Engineering',
      role: 'Tech Lead',
      location: 'Austin, TX',
    },
    fields: [
      { name: 'name', label: 'Full Name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'department', label: 'Department' },
      { name: 'role', label: 'Role' },
      { name: 'location', label: 'Location' },
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
    title: 'Account: TechCorp Inc.',
    data: {
      name: 'TechCorp Inc.',
      industry: 'Software',
      website: 'https://techcorp.io',
      employees: '200-500',
      revenue: '$25M - $50M',
      street: '456 Innovation Blvd',
      city: 'Seattle',
      state: 'WA',
      zipcode: '98101',
      country: 'USA',
    },
    sections: [
      {
        title: 'Company Info',
        icon: '🏢',
        fields: [
          { name: 'name', label: 'Company Name' },
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
        fields: [
          { name: 'street', label: 'Street' },
          { name: 'city', label: 'City' },
          { name: 'state', label: 'State' },
          { name: 'zipcode', label: 'Zip Code' },
          { name: 'country', label: 'Country' },
        ],
        columns: 2,
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
    title: 'Account: TechCorp Inc.',
    data: {
      name: 'TechCorp Inc.',
      industry: 'Software',
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
          { id: '1', name: 'Mike Ross', email: 'mike@techcorp.io', title: 'VP Engineering' },
          { id: '2', name: 'Lisa Chen', email: 'lisa@techcorp.io', title: 'Product Manager' },
        ],
        columns: ['name', 'email', 'title'],
      },
      {
        title: 'Opportunities',
        type: 'table',
        data: [
          { id: '1', name: 'Enterprise License', amount: '$120,000', stage: 'Negotiation' },
          { id: '2', name: 'Support Contract', amount: '$45,000', stage: 'Proposal' },
        ],
        columns: ['name', 'amount', 'stage'],
      },
    ],
    showBack: true,
    showEdit: true,
    showDelete: true,
  } as any,
};
