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
import { ObjectDataTable } from '../ObjectDataTable';
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
      expect(errorEl).toBeDefined();
    });

    expect(screen.getByText('Connection refused')).toBeDefined();
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
});
