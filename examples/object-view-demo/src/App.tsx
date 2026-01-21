/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState } from 'react';
import { ObjectView } from '@object-ui/plugin-object';
import type { ObjectViewSchema } from '@object-ui/types';
import type { ObjectQLDataSource } from '@object-ui/data-objectql';

// Mock data for demonstration
const mockUsers = [
  { _id: '1', name: 'John Doe', email: 'john@example.com', status: 'active', role: 'Admin', createdAt: '2024-01-15' },
  { _id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'active', role: 'User', createdAt: '2024-01-16' },
  { _id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'inactive', role: 'User', createdAt: '2024-01-17' },
  { _id: '4', name: 'Alice Williams', email: 'alice@example.com', status: 'active', role: 'Editor', createdAt: '2024-01-18' },
  { _id: '5', name: 'Charlie Brown', email: 'charlie@example.com', status: 'active', role: 'User', createdAt: '2024-01-19' },
];

// Mock ObjectQL data source
const createMockDataSource = (): ObjectQLDataSource => {
  let data = [...mockUsers];

  return {
    // Find all records
    find: async (objectName: string, params?: Record<string, unknown>) => {
      console.log('find:', objectName, params);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay
      return {
        data: data,
        total: data.length,
      };
    },

    // Find one record by ID
    findOne: async (objectName: string, id: string | number) => {
      console.log('findOne:', objectName, id);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return data.find((item) => item._id === id) || null;
    },

    // Create a new record
    create: async (objectName: string, record: Record<string, unknown>) => {
      console.log('create:', objectName, record);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const newRecord = {
        _id: String(Date.now()),
        ...record,
        createdAt: new Date().toISOString().split('T')[0],
      };
      data.push(newRecord);
      return newRecord;
    },

    // Update an existing record
    update: async (objectName: string, id: string | number, record: Record<string, unknown>) => {
      console.log('update:', objectName, id, record);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const index = data.findIndex((item) => item._id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...record };
        return data[index];
      }
      throw new Error('Record not found');
    },

    // Delete a record
    delete: async (objectName: string, id: string | number) => {
      console.log('delete:', objectName, id);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const index = data.findIndex((item) => item._id === id);
      if (index !== -1) {
        data.splice(index, 1);
        return true;
      }
      return false;
    },

    // Bulk operations
    bulk: async (objectName: string, operation: string, records: Record<string, unknown>[]) => {
      console.log('bulk:', objectName, operation, records);
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (operation === 'delete') {
        const ids = records.map((r) => r._id || r.id);
        data = data.filter((item) => !ids.includes(item._id));
        return records;
      }
      return [];
    },

    // Get object schema
    getObjectSchema: async (objectName: string) => {
      console.log('getObjectSchema:', objectName);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        name: objectName,
        label: 'Users',
        fields: {
          name: {
            type: 'text',
            label: 'Name',
            required: true,
            placeholder: 'Enter full name',
          },
          email: {
            type: 'email',
            label: 'Email',
            required: true,
            placeholder: 'user@example.com',
          },
          status: {
            type: 'select',
            label: 'Status',
            required: true,
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          role: {
            type: 'select',
            label: 'Role',
            required: true,
            options: [
              { value: 'Admin', label: 'Admin' },
              { value: 'Editor', label: 'Editor' },
              { value: 'User', label: 'User' },
            ],
          },
          createdAt: {
            type: 'date',
            label: 'Created At',
            readonly: true,
          },
        },
      };
    },
  } as ObjectQLDataSource;
};

function App() {
  const [layout, setLayout] = useState<'drawer' | 'modal' | 'page'>('drawer');
  const [dataSource] = useState(createMockDataSource());

  const schema: ObjectViewSchema = {
    type: 'object-view',
    objectName: 'users',
    title: 'User Management',
    description: 'Manage users in your system with search, filters, and CRUD operations.',
    layout: layout,
    showSearch: true,
    showFilters: true,
    showCreate: true,
    showRefresh: true,
    operations: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    table: {
      fields: ['name', 'email', 'status', 'role', 'createdAt'],
      pageSize: 10,
      selectable: 'multiple',
      defaultSort: {
        field: 'name',
        order: 'asc',
      },
    },
    form: {
      fields: ['name', 'email', 'status', 'role'],
      layout: 'vertical',
      columns: 1,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ObjectView Demo</h1>
              <p className="mt-1 text-sm text-gray-500">
                Complete CRUD interface with integrated table and form
              </p>
            </div>
            
            {/* Layout Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setLayout('drawer')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  layout === 'drawer'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Drawer Mode
              </button>
              <button
                onClick={() => setLayout('modal')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  layout === 'modal'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Modal Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <ObjectView
            key={layout} // Re-mount when layout changes
            schema={schema}
            dataSource={dataSource}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-sm text-gray-500">
            <h3 className="font-semibold text-gray-900 mb-2">Features Demonstrated:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Integrated ObjectTable with automatic column generation</li>
              <li>ObjectForm with drawer/modal layouts for create/edit operations</li>
              <li>Search functionality across records</li>
              <li>Filter builder placeholder for advanced filtering</li>
              <li>CRUD operations (Create, Read, Update, Delete)</li>
              <li>Bulk delete with row selection</li>
              <li>Auto-refresh after form submission</li>
              <li>Responsive design with Tailwind CSS</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
