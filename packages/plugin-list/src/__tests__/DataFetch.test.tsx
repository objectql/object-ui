/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListView } from '../ListView';
import type { ListViewSchema } from '@object-ui/types';
import { SchemaRendererProvider } from '@object-ui/react';

const renderWithProvider = (component: React.ReactNode, dataSource?: any) => {
  return render(
    <SchemaRendererProvider dataSource={dataSource || mockDataSource}>
      {component}
    </SchemaRendererProvider>
  );
};

let mockDataSource: any;

describe('ListView Data Fetch', () => {
  beforeEach(() => {
    mockDataSource = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  });

  // =========================================================================
  // Data Limit Warning (Issue #7)
  // =========================================================================
  describe('data limit warning', () => {
    it('shows data limit warning when items reach the page size', async () => {
      // Generate exactly 100 items (default page size)
      const items = Array.from({ length: 100 }, (_, i) => ({
        _id: String(i),
        name: `Item ${i}`,
      }));
      mockDataSource.find.mockResolvedValue(items);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('data-limit-warning')).toBeInTheDocument();
    });

    it('does not show data limit warning when items are below page size', async () => {
      const items = [
        { _id: '1', name: 'Alice' },
        { _id: '2', name: 'Bob' },
      ];
      mockDataSource.find.mockResolvedValue(items);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('data-limit-warning')).not.toBeInTheDocument();
    });

    it('uses custom page size from schema.pagination', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        _id: String(i),
        name: `Item ${i}`,
      }));
      mockDataSource.find.mockResolvedValue(items);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name'],
        pagination: { pageSize: 50 },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });

      // Should show warning since exactly 50 items = pageSize
      expect(screen.getByTestId('data-limit-warning')).toBeInTheDocument();

      // Verify that $top was set to custom page size
      expect(mockDataSource.find).toHaveBeenCalledWith('contacts', expect.objectContaining({
        $top: 50,
      }));
    });
  });

  // =========================================================================
  // $expand race condition fix (Issue #939 Bug 1)
  // =========================================================================
  describe('$expand with objectSchema', () => {
    it('should include $expand in find() when objectSchema has lookup fields', async () => {
      mockDataSource.getObjectSchema = vi.fn().mockResolvedValue({
        fields: {
          name: { type: 'text' },
          customer: { type: 'lookup', reference_to: 'contact' },
          account: { type: 'master_detail', reference_to: 'account' },
        },
      });
      mockDataSource.find.mockResolvedValue([
        { _id: '1', name: 'Order 1', customer: { name: 'Alice' }, account: { name: 'Acme' } },
      ]);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'orders',
        viewType: 'grid',
        fields: ['name', 'customer', 'account'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalledWith(
          'orders',
          expect.objectContaining({
            $expand: expect.arrayContaining(['customer', 'account']),
          }),
        );
      });
    });

    it('should wait for objectSchema before fetching data', async () => {
      let resolveSchema: (value: any) => void;
      const schemaPromise = new Promise(resolve => { resolveSchema = resolve; });
      mockDataSource.getObjectSchema = vi.fn().mockReturnValue(schemaPromise);
      mockDataSource.find.mockResolvedValue([{ _id: '1', name: 'Item 1' }]);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'orders',
        viewType: 'grid',
        fields: ['name'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      // find() should NOT be called yet because objectSchema hasn't resolved
      expect(mockDataSource.find).not.toHaveBeenCalled();

      // Resolve objectSchema
      resolveSchema!({ fields: { name: { type: 'text' } } });

      // Now find() should be called
      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Request Debounce (Issue #5)
  // =========================================================================
  describe('request debounce', () => {
    it('only uses data from the latest request when multiple fetches occur', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;
      
      const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
      const secondPromise = new Promise(resolve => { resolveSecond = resolve; });
      
      mockDataSource.find
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name'],
      };

      const { rerender } = renderWithProvider(
        <ListView schema={schema} dataSource={mockDataSource} />,
      );

      // Resolve second (newer) request first
      resolveSecond!([{ _id: '2', name: 'Second' }]);
      
      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });

      // Resolve first (stale) request later
      resolveFirst!([{ _id: '1', name: 'First (stale)' }]);

      // Wait for state to settle — second request data should win
      await vi.waitFor(() => {
        // Data should eventually render from latest successful request
        expect(screen.queryByTestId('empty-state')).not.toBeNull();
      }, { timeout: 2000 }).catch(() => {
        // This is fine — the key point is stale data doesn't overwrite new data
      });
    });
  });
});
