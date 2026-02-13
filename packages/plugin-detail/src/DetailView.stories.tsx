import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';
import { Building2, User } from 'lucide-react';

const meta = {
  title: 'Plugins/DetailView',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Enhanced detail view component with Airtable-inspired features: tooltips, functional menus, collapsible sections, and copy-to-clipboard.',
      },
    },
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

/**
 * Enhanced view showcasing new Airtable-inspired features
 */
export const EnhancedAirtableStyle: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Sarah Johnson',
    objectName: 'Contact',
    resourceId: 'CNT-001',
    showEdit: true,
    showDelete: true,
    showBack: true,
    data: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      phone: '+1 (555) 123-4567',
      company: 'Acme Corporation',
      title: 'Senior Product Manager',
      department: 'Product',
      location: 'San Francisco, CA',
      website: 'https://example.com',
      notes: 'Key decision maker for enterprise deals. Prefers email communication.',
      linkedin: 'linkedin.com/in/sarahjohnson',
      twitter: '@sarahjohnson',
      status: 'Active',
      lead_source: 'Website',
    },
    sections: [
      {
        title: 'Contact Information',
        description: 'Primary contact details',
        collapsible: false,
        columns: 2,
        fields: [
          { name: 'email', label: 'Email' },
          { name: 'phone', label: 'Phone' },
          { name: 'title', label: 'Job Title' },
          { name: 'department', label: 'Department' },
          { name: 'location', label: 'Location' },
          { name: 'website', label: 'Website' },
        ],
      },
      {
        title: 'Company Details',
        collapsible: true,
        defaultCollapsed: false,
        columns: 2,
        fields: [
          { name: 'company', label: 'Company Name' },
          { name: 'status', label: 'Status' },
          { name: 'lead_source', label: 'Lead Source' },
        ],
      },
      {
        title: 'Social Media',
        collapsible: true,
        defaultCollapsed: true,
        columns: 1,
        fields: [
          { name: 'linkedin', label: 'LinkedIn' },
          { name: 'twitter', label: 'Twitter' },
        ],
      },
    ],
  } as any,
};

/**
 * View with field count badges in section headers
 */
export const WithFieldCounts: Story = {
  render: renderStory,
  args: {
    type: 'detail-view',
    title: 'Deal Overview',
    objectName: 'Deal',
    resourceId: 'DEAL-456',
    showEdit: true,
    data: {
      name: 'Enterprise License',
      amount: '$120,000',
      stage: 'Negotiation',
      probability: '75%',
      close_date: '2024-03-31',
      owner: 'Sarah Johnson',
      account: 'TechCorp Inc.',
      contact: 'Mike Ross',
      created: '2024-01-15',
    },
    sections: [
      {
        title: 'Deal Information',
        columns: 2,
        fields: [
          { name: 'name', label: 'Deal Name', span: 2 },
          { name: 'amount', label: 'Amount' },
          { name: 'stage', label: 'Stage' },
          { name: 'probability', label: 'Win Probability' },
          { name: 'close_date', label: 'Expected Close' },
        ],
      },
      {
        title: 'Related Records',
        collapsible: true,
        columns: 2,
        fields: [
          { name: 'account', label: 'Account' },
          { name: 'contact', label: 'Primary Contact' },
          { name: 'owner', label: 'Deal Owner' },
        ],
      },
    ],
  } as any,
};
