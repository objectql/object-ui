/**
 * ObjectUI — List Refresh Tests
 * Tests for the standardized list refresh after mutation mechanism.
 *
 * Covers:
 *  - P0: refreshTrigger prop triggers data re-fetch
 *  - P1: Imperative refresh() via forwardRef
 *  - P2: Auto-refresh via DataSource.onMutation()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, act } from '@testing-library/react';
import { ListView } from '../ListView';
import type { ListViewHandle } from '../ListView';
import type { ListViewSchema } from '@object-ui/types';
import { SchemaRendererProvider } from '@object-ui/react';

let mockDataSource: any;

const renderWithProvider = (component: React.ReactNode, ds?: any) =>
  render(
    <SchemaRendererProvider dataSource={ds || mockDataSource}>
      {component}
    </SchemaRendererProvider>,
  );

describe('ListView Refresh Mechanisms', () => {
  beforeEach(() => {
    mockDataSource = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({ name: 'contacts', fields: {} }),
    };
  });

  // =========================================================================
  // P0: refreshTrigger schema prop
  // =========================================================================
  describe('P0 — refreshTrigger prop', () => {
    it('should re-fetch data when refreshTrigger changes', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
        refreshTrigger: 0,
      };

      const { rerender } = renderWithProvider(
        <ListView schema={schema} dataSource={mockDataSource} />,
      );

      // Wait for initial data fetch
      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });

      const initialCallCount = mockDataSource.find.mock.calls.length;

      // Increment refreshTrigger → should trigger a new data fetch
      const updatedSchema: ListViewSchema = { ...schema, refreshTrigger: 1 };
      rerender(
        <SchemaRendererProvider dataSource={mockDataSource}>
          <ListView schema={updatedSchema} dataSource={mockDataSource} />
        </SchemaRendererProvider>,
      );

      await vi.waitFor(() => {
        expect(mockDataSource.find.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should NOT re-fetch when refreshTrigger stays the same', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
        refreshTrigger: 5,
      };

      const { rerender } = renderWithProvider(
        <ListView schema={schema} dataSource={mockDataSource} />,
      );

      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });

      const callCount = mockDataSource.find.mock.calls.length;

      // Re-render with the same refreshTrigger → no extra fetch
      rerender(
        <SchemaRendererProvider dataSource={mockDataSource}>
          <ListView schema={{ ...schema }} dataSource={mockDataSource} />
        </SchemaRendererProvider>,
      );

      // Wait a tick and verify no extra call
      await new Promise(r => setTimeout(r, 100));
      expect(mockDataSource.find.mock.calls.length).toBe(callCount);
    });
  });

  // =========================================================================
  // P1: Imperative refresh() via forwardRef
  // =========================================================================
  describe('P1 — imperative refresh() API', () => {
    it('should expose a refresh() method via ref', () => {
      const ref = React.createRef<ListViewHandle>();
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
      };

      renderWithProvider(<ListView ref={ref} schema={schema} dataSource={mockDataSource} />);

      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.refresh).toBe('function');
    });

    it('calling refresh() should trigger a data re-fetch', async () => {
      const ref = React.createRef<ListViewHandle>();
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
      };

      renderWithProvider(<ListView ref={ref} schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });

      const callCount = mockDataSource.find.mock.calls.length;

      // Call imperative refresh
      act(() => {
        ref.current?.refresh();
      });

      await vi.waitFor(() => {
        expect(mockDataSource.find.mock.calls.length).toBeGreaterThan(callCount);
      });
    });
  });

  // =========================================================================
  // P2: Auto-refresh via DataSource.onMutation()
  // =========================================================================
  describe('P2 — DataSource.onMutation() auto-refresh', () => {
    it('should auto-refresh when a mutation event fires for the same resource', async () => {
      let mutationCallback: ((event: any) => void) | null = null;
      const unsub = vi.fn();

      const dsWithMutation = {
        ...mockDataSource,
        onMutation: vi.fn((cb: any) => {
          mutationCallback = cb;
          return unsub;
        }),
      };

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
      };

      renderWithProvider(
        <ListView schema={schema} dataSource={dsWithMutation} />,
        dsWithMutation,
      );

      await vi.waitFor(() => {
        expect(dsWithMutation.find).toHaveBeenCalled();
      });

      const callCount = dsWithMutation.find.mock.calls.length;

      // Simulate a mutation on the same resource
      act(() => {
        mutationCallback?.({ type: 'create', resource: 'contacts', record: { id: '1' } });
      });

      await vi.waitFor(() => {
        expect(dsWithMutation.find.mock.calls.length).toBeGreaterThan(callCount);
      });
    });

    it('should NOT refresh when a mutation fires for a different resource', async () => {
      let mutationCallback: ((event: any) => void) | null = null;

      const dsWithMutation = {
        ...mockDataSource,
        onMutation: vi.fn((cb: any) => {
          mutationCallback = cb;
          return vi.fn();
        }),
      };

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
      };

      renderWithProvider(
        <ListView schema={schema} dataSource={dsWithMutation} />,
        dsWithMutation,
      );

      await vi.waitFor(() => {
        expect(dsWithMutation.find).toHaveBeenCalled();
      });

      const callCount = dsWithMutation.find.mock.calls.length;

      // Fire a mutation for a different resource
      act(() => {
        mutationCallback?.({ type: 'create', resource: 'accounts', record: { id: '2' } });
      });

      // Should NOT trigger a refresh
      await new Promise(r => setTimeout(r, 100));
      expect(dsWithMutation.find.mock.calls.length).toBe(callCount);
    });

    it('should unsubscribe when unmounted', async () => {
      const unsub = vi.fn();
      const dsWithMutation = {
        ...mockDataSource,
        onMutation: vi.fn(() => unsub),
      };

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
      };

      const { unmount } = renderWithProvider(
        <ListView schema={schema} dataSource={dsWithMutation} />,
        dsWithMutation,
      );

      await vi.waitFor(() => {
        expect(dsWithMutation.onMutation).toHaveBeenCalled();
      });

      unmount();
      expect(unsub).toHaveBeenCalled();
    });

    it('should work without onMutation (backward compatible)', async () => {
      // DataSource without onMutation — should not throw
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        fields: ['name'],
      };

      renderWithProvider(
        <ListView schema={schema} dataSource={mockDataSource} />,
      );

      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });
    });
  });
});
