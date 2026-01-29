/**
 * ObjectAgGrid Example
 * 
 * This example demonstrates how to use the ObjectAgGrid component
 * with @objectstack/client to create a metadata-driven data grid.
 */

import React from 'react';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { ObjectAgGridRenderer } from '@object-ui/plugin-aggrid';

// Example: Create a data source with mock data
const createExampleDataSource = () => {
  // Mock contacts data
  const contactsData = [
    { 
      id: '1', 
      name: 'John Doe', 
      email: 'john.doe@example.com', 
      phone: '+1-555-0101',
      company: 'Acme Corp',
      title: 'CEO',
      status: 'Active',
      revenue: 1500000,
      probability: 0.85,
      created_date: '2024-01-15',
      website: 'https://acme.example.com',
      color: '#3B82F6',
      rating: 5,
      premium: true
    },
    { 
      id: '2', 
      name: 'Jane Smith', 
      email: 'jane.smith@example.com', 
      phone: '+1-555-0102',
      company: 'Tech Solutions',
      title: 'CTO',
      status: 'Active',
      revenue: 890000,
      probability: 0.72,
      created_date: '2024-01-20',
      website: 'https://techsolutions.example.com',
      color: '#10B981',
      rating: 4,
      premium: true
    },
    { 
      id: '3', 
      name: 'Bob Johnson', 
      email: 'bob.johnson@example.com', 
      phone: '+1-555-0103',
      company: 'Innovate Inc',
      title: 'Product Manager',
      status: 'Inactive',
      revenue: 450000,
      probability: 0.45,
      created_date: '2024-02-01',
      website: 'https://innovate.example.com',
      color: '#F59E0B',
      rating: 3,
      premium: false
    },
    { 
      id: '4', 
      name: 'Alice Williams', 
      email: 'alice.w@example.com', 
      phone: '+1-555-0104',
      company: 'Creative Studio',
      title: 'Creative Director',
      status: 'Active',
      revenue: 675000,
      probability: 0.68,
      created_date: '2024-02-10',
      website: 'https://creative.example.com',
      color: '#8B5CF6',
      rating: 5,
      premium: true
    },
    { 
      id: '5', 
      name: 'Charlie Brown', 
      email: 'charlie.b@example.com', 
      phone: '+1-555-0105',
      company: 'Digital Agency',
      title: 'Marketing Director',
      status: 'Active',
      revenue: 1200000,
      probability: 0.92,
      created_date: '2024-02-15',
      website: 'https://digitalagency.example.com',
      color: '#EF4444',
      rating: 4,
      premium: true
    },
  ];

  // Mock object schema
  const contactsSchema = {
    name: 'contacts',
    label: 'Contacts',
    description: 'Business contacts and leads',
    fields: {
      id: {
        name: 'id',
        label: 'ID',
        type: 'text',
        readonly: true,
        sortable: true,
        filterable: false
      },
      name: {
        name: 'name',
        label: 'Name',
        type: 'text',
        sortable: true,
        filterable: true,
        required: true
      },
      email: {
        name: 'email',
        label: 'Email',
        type: 'email',
        sortable: true,
        filterable: true,
        required: true
      },
      phone: {
        name: 'phone',
        label: 'Phone',
        type: 'phone',
        sortable: true,
        filterable: true
      },
      company: {
        name: 'company',
        label: 'Company',
        type: 'text',
        sortable: true,
        filterable: true
      },
      title: {
        name: 'title',
        label: 'Job Title',
        type: 'text',
        sortable: true,
        filterable: true
      },
      status: {
        name: 'status',
        label: 'Status',
        type: 'select',
        sortable: true,
        filterable: true,
        options: [
          { label: 'Active', value: 'Active' },
          { label: 'Inactive', value: 'Inactive' }
        ]
      },
      revenue: {
        name: 'revenue',
        label: 'Annual Revenue',
        type: 'currency',
        currency: 'USD',
        precision: 0,
        sortable: true,
        filterable: true
      },
      probability: {
        name: 'probability',
        label: 'Win Probability',
        type: 'percent',
        precision: 0,
        sortable: true,
        filterable: true
      },
      created_date: {
        name: 'created_date',
        label: 'Created Date',
        type: 'date',
        sortable: true,
        filterable: true
      },
      website: {
        name: 'website',
        label: 'Website',
        type: 'url',
        sortable: false,
        filterable: false
      },
      color: {
        name: 'color',
        label: 'Tag Color',
        type: 'color',
        sortable: false,
        filterable: false
      },
      rating: {
        name: 'rating',
        label: 'Rating',
        type: 'rating',
        max: 5,
        sortable: true,
        filterable: true
      },
      premium: {
        name: 'premium',
        label: 'Premium Customer',
        type: 'boolean',
        sortable: true,
        filterable: true
      }
    }
  };

  // Create a mock data source
  return {
    find: async (resource: string, params: any) => {
      return {
        data: contactsData,
        total: contactsData.length,
        page: 1,
        pageSize: contactsData.length,
        hasMore: false
      };
    },
    findOne: async (resource: string, id: string) => {
      return contactsData.find(c => c.id === id) || null;
    },
    create: async (resource: string, data: any) => {
      return { ...data, id: String(Date.now()) };
    },
    update: async (resource: string, id: string, data: any) => {
      console.log('Updating record:', id, data);
      return { id, ...data };
    },
    delete: async (resource: string, id: string) => {
      return true;
    },
    getObjectSchema: async (objectName: string) => {
      return contactsSchema;
    }
  } as any;
};

// Example 1: Basic ObjectAgGrid
export function BasicObjectAgGrid() {
  const dataSource = createExampleDataSource();

  const schema = {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: dataSource,
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    columnConfig: {
      resizable: true,
      sortable: true,
      filterable: true
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Basic ObjectAgGrid Example</h2>
      <p className="text-muted-foreground mb-4">
        Metadata-driven grid that automatically generates columns from object schema.
        All field types are supported with appropriate formatters.
      </p>
      <ObjectAgGridRenderer schema={schema as any} />
    </div>
  );
}

// Example 2: ObjectAgGrid with Field Selection
export function ObjectAgGridWithFieldSelection() {
  const dataSource = createExampleDataSource();

  const schema = {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: dataSource,
    fieldNames: ['name', 'email', 'company', 'status', 'revenue', 'rating'],
    pagination: true,
    pageSize: 10,
    theme: 'alpine',
    height: 400
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">ObjectAgGrid with Field Selection</h2>
      <p className="text-muted-foreground mb-4">
        Show only specific fields using the <code>fieldNames</code> prop.
      </p>
      <ObjectAgGridRenderer schema={schema as any} />
    </div>
  );
}

// Example 3: Editable ObjectAgGrid
export function EditableObjectAgGrid() {
  const dataSource = createExampleDataSource();

  const schema = {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: dataSource,
    editable: true,
    singleClickEdit: true,
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    callbacks: {
      onCellValueChanged: (event: any) => {
        console.log('Cell value changed:', event.data, event.colDef.field, event.newValue);
        alert(`Updated ${event.colDef.field} to ${event.newValue}`);
      },
      onDataLoaded: (data: any[]) => {
        console.log('Data loaded:', data.length, 'records');
      }
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Editable ObjectAgGrid</h2>
      <p className="text-muted-foreground mb-4">
        Enable inline editing with automatic backend updates.
        Try editing any cell (single-click to edit).
      </p>
      <ObjectAgGridRenderer schema={schema as any} />
    </div>
  );
}

// Example 4: ObjectAgGrid with Export
export function ObjectAgGridWithExport() {
  const dataSource = createExampleDataSource();

  const schema = {
    type: 'object-aggrid',
    objectName: 'contacts',
    dataSource: dataSource,
    pagination: true,
    pageSize: 10,
    theme: 'quartz',
    height: 500,
    exportConfig: {
      enabled: true,
      fileName: 'contacts-export.csv'
    },
    callbacks: {
      onExport: (data: any[], format: string) => {
        console.log(`Exporting ${data.length} records as ${format}`);
      }
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">ObjectAgGrid with CSV Export</h2>
      <p className="text-muted-foreground mb-4">
        Export grid data to CSV with a single click.
      </p>
      <ObjectAgGridRenderer schema={schema as any} />
    </div>
  );
}

// Main demo component
export default function ObjectAgGridDemo() {
  return (
    <div className="container mx-auto py-8 space-y-12">
      <div>
        <h1 className="text-4xl font-bold mb-2">ObjectAgGrid Examples</h1>
        <p className="text-muted-foreground">
          Metadata-driven AG Grid component powered by @objectstack/client
        </p>
      </div>

      <BasicObjectAgGrid />
      <ObjectAgGridWithFieldSelection />
      <EditableObjectAgGrid />
      <ObjectAgGridWithExport />
    </div>
  );
}
