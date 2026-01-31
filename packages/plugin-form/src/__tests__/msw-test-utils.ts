/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MSW Test Utilities
 * 
 * Reusable utilities for setting up MSW-based testing for metadata-driven
 * tables and forms. This module provides:
 * - MSW server setup and teardown
 * - Mock data factories
 * - API endpoint handlers for ObjectStack/ObjectQL
 * - Test data source adapters
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { DataSource } from '@object-ui/types';

/**
 * Mock object schema data
 */
export const mockTaskSchema = {
  name: 'task',
  label: 'Task',
  description: 'Task management object',
  fields: {
    id: {
      name: 'id',
      label: 'ID',
      type: 'text',
      required: true,
      readonly: true,
    },
    subject: {
      name: 'subject',
      label: 'Subject',
      type: 'text',
      required: true,
    },
    priority: {
      name: 'priority',
      label: 'Priority',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 10,
    },
    isCompleted: {
      name: 'isCompleted',
      label: 'Completed',
      type: 'boolean',
      defaultValue: false,
    },
    createdAt: {
      name: 'createdAt',
      label: 'Created At',
      type: 'datetime',
      readonly: true,
    },
  },
};

export const mockUserSchema = {
  name: 'user',
  label: 'User',
  description: 'User management object',
  fields: {
    id: {
      name: 'id',
      label: 'ID',
      type: 'text',
      required: true,
      readonly: true,
    },
    name: {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
    },
    email: {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
  },
};

/**
 * Mock task data
 */
export const mockTasks = [
  {
    id: '1',
    subject: 'Complete project documentation',
    priority: 8,
    isCompleted: false,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    subject: 'Review pull requests',
    priority: 6,
    isCompleted: true,
    createdAt: '2024-01-16T14:30:00Z',
  },
  {
    id: '3',
    subject: 'Update dependencies',
    priority: 4,
    isCompleted: false,
    createdAt: '2024-01-17T09:15:00Z',
  },
];

/**
 * Mock user data
 */
export const mockUsers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'active',
  },
];

/**
 * In-memory data store for MSW handlers
 */
class MockDataStore {
  private data: Record<string, any[]> = {
    task: [...mockTasks],
    user: [...mockUsers],
  };
  
  private schemas: Record<string, any> = {
    task: mockTaskSchema,
    user: mockUserSchema,
  };

  getSchema(objectName: string) {
    return this.schemas[objectName];
  }

  findAll(objectName: string, params?: any) {
    let items = [...(this.data[objectName] || [])];
    
    // Apply filtering
    if (params?.$filter) {
      // Simple filter support for testing
      items = items.filter((item) => {
        return params.$filter.every((filter: any) => {
          const [field, operator, value] = filter;
          if (operator === 'eq') return item[field] === value;
          if (operator === 'ne') return item[field] !== value;
          if (operator === 'gt') return item[field] > value;
          if (operator === 'lt') return item[field] < value;
          return true;
        });
      });
    }
    
    // Apply sorting
    if (params?.$orderby) {
      const [field, order] = params.$orderby.split(' ');
      items.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === 'desc' ? -comparison : comparison;
      });
    }
    
    // Apply pagination
    const top = params?.$top || items.length;
    const skip = params?.$skip || 0;
    const paginatedItems = items.slice(skip, skip + top);
    
    return {
      data: paginatedItems,
      total: items.length,
    };
  }

  findOne(objectName: string, id: string) {
    const items = this.data[objectName] || [];
    return items.find((item) => item.id === id);
  }

  create(objectName: string, data: any) {
    const items = this.data[objectName] || [];
    const newItem = {
      id: String(items.length + 1),
      ...data,
      createdAt: new Date().toISOString(),
    };
    items.push(newItem);
    return newItem;
  }

  update(objectName: string, id: string, data: any) {
    const items = this.data[objectName] || [];
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    
    items[index] = { ...items[index], ...data };
    return items[index];
  }

  delete(objectName: string, id: string) {
    const items = this.data[objectName] || [];
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    
    items.splice(index, 1);
    return true;
  }

  reset() {
    this.data = {
      task: [...mockTasks],
      user: [...mockUsers],
    };
  }
}

export const mockDataStore = new MockDataStore();

/**
 * MSW Request Handlers for ObjectStack/ObjectQL API
 */
export const createApiHandlers = (baseUrl = '/api/v1') => [
  // Discovery endpoint
  http.get(`${baseUrl}`, () => {
    return HttpResponse.json({
      version: '1.0.0',
      name: 'test-api',
      endpoints: {
        schema: `${baseUrl}/schema/:object`,
        find: `${baseUrl}/data/:object`,
        findOne: `${baseUrl}/data/:object/:id`,
        create: `${baseUrl}/data/:object`,
        update: `${baseUrl}/data/:object/:id`,
        delete: `${baseUrl}/data/:object/:id`,
      },
    });
  }),

  // Get object schema
  http.get(`${baseUrl}/schema/:object`, ({ params }) => {
    const { object } = params;
    const schema = mockDataStore.getSchema(object as string);
    
    if (!schema) {
      return HttpResponse.json(
        { error: 'Object not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json(schema);
  }),

  // Find records
  http.get(`${baseUrl}/data/:object`, ({ params, request }) => {
    const { object } = params;
    const url = new URL(request.url);
    
    const queryParams: any = {};
    
    // Parse query parameters
    if (url.searchParams.has('$top')) {
      queryParams.$top = parseInt(url.searchParams.get('$top')!);
    }
    if (url.searchParams.has('$skip')) {
      queryParams.$skip = parseInt(url.searchParams.get('$skip')!);
    }
    if (url.searchParams.has('$orderby')) {
      queryParams.$orderby = url.searchParams.get('$orderby');
    }
    
    const result = mockDataStore.findAll(object as string, queryParams);
    return HttpResponse.json(result);
  }),

  // Find one record
  http.get(`${baseUrl}/data/:object/:id`, ({ params }) => {
    const { object, id } = params;
    const record = mockDataStore.findOne(object as string, id as string);
    
    if (!record) {
      return HttpResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json(record);
  }),

  // Create record
  http.post(`${baseUrl}/data/:object`, async ({ params, request }) => {
    const { object } = params;
    const data = await request.json();
    const newRecord = mockDataStore.create(object as string, data);
    
    return HttpResponse.json(newRecord, { status: 201 });
  }),

  // Update record
  http.put(`${baseUrl}/data/:object/:id`, async ({ params, request }) => {
    const { object, id } = params;
    const data = await request.json();
    const updatedRecord = mockDataStore.update(
      object as string,
      id as string,
      data
    );
    
    if (!updatedRecord) {
      return HttpResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json(updatedRecord);
  }),

  // Delete record
  http.delete(`${baseUrl}/data/:object/:id`, ({ params }) => {
    const { object, id } = params;
    const deleted = mockDataStore.delete(object as string, id as string);
    
    if (!deleted) {
      return HttpResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({ success: true }, { status: 204 });
  }),
];

/**
 * Create and configure MSW server for testing
 */
export function createMockServer(baseUrl = '/api/v1') {
  const handlers = createApiHandlers(baseUrl);
  return setupServer(...handlers);
}

/**
 * Mock DataSource adapter for testing
 * 
 * This adapter works with MSW to provide a realistic test environment
 */
export class MockDataSource implements DataSource {
  constructor(private baseUrl = '/api/v1') {}

  async getObjectSchema(objectName: string) {
    const response = await fetch(`${this.baseUrl}/schema/${objectName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch schema for ${objectName}`);
    }
    return response.json();
  }

  async find(objectName: string, params?: any) {
    const queryParams = new URLSearchParams();
    
    if (params?.$select) {
      queryParams.set('$select', params.$select.join(','));
    }
    if (params?.$top) {
      queryParams.set('$top', String(params.$top));
    }
    if (params?.$skip) {
      queryParams.set('$skip', String(params.$skip));
    }
    if (params?.$orderby) {
      queryParams.set('$orderby', params.$orderby);
    }
    
    const url = `${this.baseUrl}/data/${objectName}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch records for ${objectName}`);
    }
    
    return response.json();
  }

  async findOne(objectName: string, id: string) {
    const response = await fetch(`${this.baseUrl}/data/${objectName}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch record ${id} for ${objectName}`);
    }
    return response.json();
  }

  async create(objectName: string, data: any) {
    const response = await fetch(`${this.baseUrl}/data/${objectName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create record for ${objectName}`);
    }
    
    return response.json();
  }

  async update(objectName: string, id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/data/${objectName}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update record ${id} for ${objectName}`);
    }
    
    return response.json();
  }

  async delete(objectName: string, id: string) {
    const response = await fetch(`${this.baseUrl}/data/${objectName}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete record ${id} for ${objectName}`);
    }
    
    return true;
  }
}

/**
 * Helper to setup MSW for tests
 * 
 * Call this function in your test file to setup MSW.
 * The beforeAll, afterEach, and afterAll hooks must be imported from vitest in your test file.
 * 
 * @example
 * ```typescript
 * import { beforeAll, afterEach, afterAll } from 'vitest';
 * const server = setupMSW({ beforeAll, afterEach, afterAll });
 * ```
 */
export function setupMSW(hooks?: {
  beforeAll?: (fn: () => void) => void;
  afterEach?: (fn: () => void) => void;
  afterAll?: (fn: () => void) => void;
}) {
  const server = createMockServer();
  
  if (hooks?.beforeAll) {
    hooks.beforeAll(() => {
      server.listen({ onUnhandledRequest: 'error' });
    });
  }
  
  if (hooks?.afterEach) {
    hooks.afterEach(() => {
      server.resetHandlers();
      mockDataStore.reset();
    });
  }
  
  if (hooks?.afterAll) {
    hooks.afterAll(() => {
      server.close();
    });
  }
  
  return server;
}
