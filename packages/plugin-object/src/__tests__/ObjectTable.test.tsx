/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectTable } from '../ObjectTable';
import type { ObjectTableSchema, DataSource } from '@object-ui/types';

// Mock SchemaRenderer
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema, onAction }: any) => (
    <div data-testid="schema-renderer">
      <div data-testid="table-caption">{schema.caption}</div>
      <div data-testid="table-columns">{schema.columns?.length || 0} columns</div>
      <div data-testid="table-data">{schema.data?.length || 0} rows</div>
      {schema.selectable && <div data-testid="table-selectable">{schema.selectable}</div>}
      <button onClick={onAction} data-testid="refresh-button">Refresh</button>
    </div>
  ),
}));

describe('ObjectTable', () => {
  let mockDataSource: DataSource;
  let mockSchema: ObjectTableSchema;

  beforeEach(() => {
    // Mock data source
    mockDataSource = {
      find: vi.fn().mockResolvedValue({
        data: [
          { _id: '1', name: 'John Doe', email: 'john@example.com', status: 'active' },
          { _id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
        ],
        total: 2,
      }),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(true),
      bulk: vi.fn().mockResolvedValue([]),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'users',
        label: 'Users',
        fields: {
          name: {
            type: 'text',
            label: 'Name',
            required: true,
          },
          email: {
            type: 'email',
            label: 'Email',
            required: true,
          },
          status: {
            type: 'select',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        },
      }),
    } as any;

    // Mock schema
    mockSchema = {
      type: 'object-table',
      objectName: 'users',
      title: 'Users Table',
      fields: ['name', 'email', 'status'],
    };
  });

  it('should render loading state initially', () => {
    render(<ObjectTable schema={mockSchema} dataSource={mockDataSource} />);
    expect(screen.getByText(/Loading users/i)).toBeInTheDocument();
  });

  it('should fetch and display data', async () => {
    render(<ObjectTable schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('users');
    expect(mockDataSource.find).toHaveBeenCalledWith('users', expect.any(Object));
    expect(screen.getByTestId('table-data')).toHaveTextContent('2 rows');
  });

  it('should generate columns from object schema', async () => {
    render(<ObjectTable schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('table-columns')).toBeInTheDocument();
    });

    // Should have 3 columns (name, email, status)
    expect(screen.getByTestId('table-columns')).toHaveTextContent('3 columns');
  });

  it('should respect field-level permissions', async () => {
    const schemaWithPermissions = {
      name: 'users',
      label: 'Users',
      fields: {
        name: {
          type: 'text',
          label: 'Name',
          permissions: { read: true },
        },
        email: {
          type: 'email',
          label: 'Email',
          permissions: { read: false }, // No read permission
        },
        status: {
          type: 'select',
          label: 'Status',
        },
      },
    };

    mockDataSource.getObjectSchema = vi.fn().mockResolvedValue(schemaWithPermissions);

    render(<ObjectTable schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('table-columns')).toBeInTheDocument();
    });

    // Should have 2 columns (name and status, email excluded)
    expect(screen.getByTestId('table-columns')).toHaveTextContent('2 columns');
  });

  it('should add actions column when operations are enabled', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ObjectTable
        schema={{
          ...mockSchema,
          operations: { update: true, delete: true },
        }}
        dataSource={mockDataSource}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('table-columns')).toBeInTheDocument();
    });

    // Should have 4 columns (name, email, status, actions)
    expect(screen.getByTestId('table-columns')).toHaveTextContent('4 columns');
  });

  it('should support row selection for bulk operations', async () => {
    const onBulkDelete = vi.fn();

    render(
      <ObjectTable
        schema={{
          ...mockSchema,
          selectable: 'multiple',
        }}
        dataSource={mockDataSource}
        onBulkDelete={onBulkDelete}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('table-selectable')).toBeInTheDocument();
    });

    expect(screen.getByTestId('table-selectable')).toHaveTextContent('multiple');
  });

  it('should apply default filters', async () => {
    const schemaWithFilters = {
      ...mockSchema,
      defaultFilters: { status: 'active' },
    };

    render(<ObjectTable schema={schemaWithFilters} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({
          $filter: { status: 'active' },
        })
      );
    });
  });

  it('should apply default sort', async () => {
    const schemaWithSort = {
      ...mockSchema,
      defaultSort: { field: 'name', order: 'asc' as const },
    };

    render(<ObjectTable schema={schemaWithSort} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({
          $orderby: 'name asc',
        })
      );
    });
  });
});
