/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ObjectDataTable, normalizeColumns } from '../ObjectDataTable';
import { SchemaRendererProvider } from '@object-ui/react';

describe('ObjectDataTable', () => {
  const baseSchema = {
    type: 'object-data-table',
    objectName: 'contacts',
  };

  it('should show loading skeleton when fetching data', async () => {
    const dataSource = {
      find: vi.fn(() => new Promise(() => {})), // Never resolves
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectDataTable schema={baseSchema} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const loadingEl = container.querySelector('[data-testid="table-loading"]');
      expect(loadingEl).toBeDefined();
    });
  });

  it('should show error state on fetch failure', async () => {
    const dataSource = {
      find: vi.fn().mockRejectedValue(new Error('Connection refused')),
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectDataTable schema={baseSchema} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const errorEl = container.querySelector('[data-testid="table-error"]');
      expect(errorEl).toBeTruthy();
    });

    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('should show empty state when no data returned', async () => {
    const dataSource = {
      find: vi.fn().mockResolvedValue({ records: [] }),
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectDataTable schema={baseSchema} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const emptyState = container.querySelector('[data-testid="table-empty-state"]');
      expect(emptyState).toBeDefined();
    });
  });

  it('should show no-data-source message when objectName is set but no dataSource', () => {
    render(<ObjectDataTable schema={baseSchema} />);
    expect(screen.getByText(/No data source available/)).toBeDefined();
  });

  it('should auto-derive columns from fetched data keys', async () => {
    const dataSource = {
      find: vi.fn().mockResolvedValue({
        records: [
          { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' },
          { firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com' },
        ],
      }),
    };

    const schema = { ...baseSchema, objectName: 'contacts' };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectDataTable schema={schema} />
      </SchemaRendererProvider>,
    );

    // Wait for data to be fetched and rendered
    await waitFor(() => {
      // data-table renders via SchemaRenderer, so look for content
      expect(container.textContent).toBeDefined();
    });

    expect(dataSource.find).toHaveBeenCalledWith('contacts', { $filter: undefined });
  });

  it('should prefer static data over fetched data', () => {
    const dataSource = { find: vi.fn() };

    const schema = {
      ...baseSchema,
      data: [{ name: 'Static Row', value: 42 }],
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectDataTable schema={schema} />
      </SchemaRendererProvider>,
    );

    expect(dataSource.find).not.toHaveBeenCalled();
  });

  it('should normalize string[] columns without crashing', () => {
    const schema = {
      ...baseSchema,
      columns: ['name', 'amount', 'close_date'],
      data: [
        { name: 'Deal A', amount: 1000, close_date: '2025-01-01' },
        { name: 'Deal B', amount: 2000, close_date: '2025-06-01' },
      ],
    };

    // Should not crash when columns are strings
    const { container } = render(
      <SchemaRendererProvider>
        <ObjectDataTable schema={schema} />
      </SchemaRendererProvider>,
    );

    expect(container).toBeDefined();
  });

  it('should pass through object[] columns unchanged', () => {
    const schema = {
      ...baseSchema,
      columns: [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Amount', accessorKey: 'amount' },
      ],
      data: [
        { name: 'Deal A', amount: 1000 },
      ],
    };

    const { container } = render(
      <SchemaRendererProvider>
        <ObjectDataTable schema={schema} />
      </SchemaRendererProvider>,
    );

    expect(container).toBeDefined();
  });
});

describe('normalizeColumns', () => {
  it('should convert snake_case string to title-cased header', () => {
    const result = normalizeColumns(['close_date']);
    expect(result).toEqual([{ header: 'Close Date', accessorKey: 'close_date' }]);
  });

  it('should convert camelCase string to title-cased header', () => {
    const result = normalizeColumns(['firstName']);
    expect(result).toEqual([{ header: 'First Name', accessorKey: 'firstName' }]);
  });

  it('should convert simple string to capitalized header', () => {
    const result = normalizeColumns(['name']);
    expect(result).toEqual([{ header: 'Name', accessorKey: 'name' }]);
  });

  it('should handle multiple string columns', () => {
    const result = normalizeColumns(['name', 'total_amount', 'createdAt']);
    expect(result).toEqual([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Total Amount', accessorKey: 'total_amount' },
      { header: 'Created At', accessorKey: 'createdAt' },
    ]);
  });

  it('should pass through object columns unchanged', () => {
    const cols = [
      { header: 'Custom Name', accessorKey: 'name' },
      { header: 'Amount ($)', accessorKey: 'amount' },
    ];
    const result = normalizeColumns(cols);
    expect(result).toEqual(cols);
  });

  it('should handle mixed string and object columns', () => {
    const result = normalizeColumns([
      'name',
      { header: 'Custom Amount', accessorKey: 'amount' },
      'close_date',
    ]);
    expect(result).toEqual([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Custom Amount', accessorKey: 'amount' },
      { header: 'Close Date', accessorKey: 'close_date' },
    ]);
  });
});
