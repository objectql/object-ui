/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectTable Tests - @objectstack/spec view.zod Alignment
 * 
 * Tests for new features aligned with @objectstack/spec view.zod schema:
 * - ViewDataSchema (object/api/value providers)
 * - Enhanced ListColumn configuration
 * - SelectionConfig and PaginationConfig
 * - Sort and filter arrays
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectTable } from '../ObjectTable';
import type { ObjectTableSchema, DataSource } from '@object-ui/types';

// Mock SchemaRenderer
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="schema-renderer">
      <div data-testid="table-caption">{schema.caption}</div>
      <div data-testid="table-columns">{schema.columns?.length || 0} columns</div>
      <div data-testid="table-data">{schema.data?.length || 0} rows</div>
      {schema.selectable && <div data-testid="table-selectable">{String(schema.selectable)}</div>}
      {schema.pagination !== undefined && <div data-testid="table-pagination">{String(schema.pagination)}</div>}
      {schema.pageSize && <div data-testid="table-pagesize">{schema.pageSize}</div>}
      {schema.searchable !== undefined && <div data-testid="table-searchable">{String(schema.searchable)}</div>}
    </div>
  ),
}));

describe('ObjectTable - view.zod Alignment', () => {
  let mockDataSource: DataSource;

  beforeEach(() => {
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
      delete: vi.fn(),
      bulk: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'users',
        fields: {
          name: { type: 'text', label: 'Name' },
          email: { type: 'email', label: 'Email' },
          status: { type: 'select', label: 'Status' },
        },
      }),
    } as any;
  });

  describe('ViewDataSchema Support', () => {
    it('should support provider: "value" with inline items', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: {
          provider: 'value',
          items: [
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' },
          ],
        },
        columns: ['name', 'email'],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      // Should not fetch from data source
      expect(mockDataSource.find).not.toHaveBeenCalled();
      expect(screen.getByTestId('table-data')).toHaveTextContent('2 rows');
    });

    it('should support provider: "object" with object name', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users', // legacy field for backward compatibility
        data: {
          provider: 'object',
          object: 'users',
        },
        columns: ['name', 'email'],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('users');
        expect(mockDataSource.find).toHaveBeenCalledWith('users', expect.any(Object));
      });
    });

    it('should support legacy staticData field', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        staticData: [
          { name: 'Charlie', email: 'charlie@example.com' },
        ],
        columns: ['name', 'email'],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(mockDataSource.find).not.toHaveBeenCalled();
      expect(screen.getByTestId('table-data')).toHaveTextContent('1 rows');
    });
  });

  describe('Enhanced ListColumn Configuration', () => {
    it('should support ListColumn objects with enhanced properties', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: {
          provider: 'value',
          items: [{ name: 'Test', email: 'test@example.com' }],
        },
        columns: [
          {
            field: 'name',
            label: 'Full Name',
            width: 200,
            align: 'left',
            sortable: true,
          },
          {
            field: 'email',
            label: 'Email Address',
            width: 300,
            align: 'center',
            sortable: false,
          },
        ],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-columns')).toHaveTextContent('2 columns');
    });

    it('should support simple string array columns', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: {
          provider: 'value',
          items: [{ name: 'Test', email: 'test@example.com' }],
        },
        columns: ['name', 'email'],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-columns')).toHaveTextContent('2 columns');
    });
  });

  describe('SelectionConfig', () => {
    it('should support selection.type = "none"', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        selection: { type: 'none' },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-selectable')).toHaveTextContent('false');
    });

    it('should support selection.type = "single"', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        selection: { type: 'single' },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-selectable')).toHaveTextContent('single');
    });

    it('should support selection.type = "multiple"', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        selection: { type: 'multiple' },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-selectable')).toHaveTextContent('multiple');
    });

    it('should maintain backward compatibility with legacy selectable', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        selectable: 'multiple',
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-selectable')).toHaveTextContent('multiple');
    });
  });

  describe('PaginationConfig', () => {
    it('should support pagination.pageSize', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        pagination: { pageSize: 25 },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-pagesize')).toHaveTextContent('25');
    });

    it('should maintain backward compatibility with legacy pageSize', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        pageSize: 50,
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-pagesize')).toHaveTextContent('50');
    });
  });

  describe('Sort Configuration', () => {
    it('should support new array-based sort format', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        sort: [
          { field: 'name', order: 'asc' },
          { field: 'email', order: 'desc' },
        ],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            $orderby: 'name asc, email desc',
          })
        );
      });
    });

    it('should support legacy string sort format', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        sort: 'name desc',
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            $orderby: 'name desc',
          })
        );
      });
    });

    it('should maintain backward compatibility with defaultSort', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        defaultSort: { field: 'email', order: 'asc' },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            $orderby: 'email asc',
          })
        );
      });
    });
  });

  describe('Filter Configuration', () => {
    it('should support new array-based filter format', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        filter: [{ field: 'status', operator: 'eq', value: 'active' }],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            $filter: [{ field: 'status', operator: 'eq', value: 'active' }],
          })
        );
      });
    });

    it('should maintain backward compatibility with defaultFilters', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        defaultFilters: { status: 'active' },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            $filter: { status: 'active' },
          })
        );
      });
    });
  });

  describe('Search Configuration', () => {
    it('should enable search when searchableFields is provided', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        searchableFields: ['name', 'email'],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-searchable')).toHaveTextContent('true');
    });

    it('should disable search when searchableFields is empty', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        searchableFields: [],
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-searchable')).toHaveTextContent('false');
    });

    it('should maintain backward compatibility with showSearch', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        data: { provider: 'value', items: [] },
        showSearch: false,
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-searchable')).toHaveTextContent('false');
    });
  });

  describe('Label and Name Fields', () => {
    it('should use label for table caption', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        label: 'User Management',
        data: { provider: 'value', items: [] },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-caption')).toHaveTextContent('User Management');
    });

    it('should fallback to title when label is not provided', async () => {
      const schema: ObjectTableSchema = {
        type: 'object-table',
        objectName: 'users',
        title: 'Users Table',
        data: { provider: 'value', items: [] },
      };

      render(<ObjectTable schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-caption')).toHaveTextContent('Users Table');
    });
  });
});
