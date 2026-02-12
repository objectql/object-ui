/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.3 Plugin View Robustness - Grid View States
 *
 * Tests empty, loading, error states for VirtualGrid component,
 * and edge cases like single-row data, many columns, and missing fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { VirtualGridColumn, VirtualGridProps } from '../VirtualGrid';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: any) => {
    const count: number = opts.count;
    const size: number = opts.estimateSize();
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({ index: i, key: String(i), start: i * size, size });
    }
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * size,
    };
  },
}));

const defaultColumns: VirtualGridColumn[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Email', accessorKey: 'email' },
  { header: 'Status', accessorKey: 'status' },
];

type VirtualGridComponent = React.FC<VirtualGridProps>;
let VirtualGrid: VirtualGridComponent;

beforeEach(async () => {
  cleanup();
  vi.resetModules();
  const mod = await import('../VirtualGrid');
  VirtualGrid = mod.VirtualGrid;
});

function renderGrid(overrides: Partial<VirtualGridProps> = {}) {
  return render(
    <VirtualGrid
      data={[]}
      columns={defaultColumns}
      {...overrides}
    />
  );
}

describe('P3.3 Grid View States', () => {
  // ---------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------
  describe('empty state', () => {
    it('renders column headers with empty data', () => {
      renderGrid({ data: [] });
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('shows 0 rows in footer for empty data', () => {
      renderGrid({ data: [] });
      expect(screen.getByText(/Showing 0 of 0 rows/)).toBeInTheDocument();
    });

    it('does not render any data cells for empty data', () => {
      renderGrid({ data: [] });
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('renders with empty columns array', () => {
      const { container } = renderGrid({ data: [], columns: [] });
      expect(container.firstElementChild).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Normal data rendering
  // ---------------------------------------------------------------
  describe('normal data rendering', () => {
    const sampleData = [
      { name: 'Alice', email: 'alice@test.com', status: 'active' },
      { name: 'Bob', email: 'bob@test.com', status: 'inactive' },
    ];

    it('renders all rows', () => {
      renderGrid({ data: sampleData });
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('shows correct row count', () => {
      renderGrid({ data: sampleData });
      expect(screen.getByText(/Showing 2 of 2 rows/)).toBeInTheDocument();
    });

    it('renders all column values', () => {
      renderGrid({ data: sampleData });
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('renders single row', () => {
      renderGrid({ data: [{ name: 'Solo', email: 'solo@test.com', status: 'ok' }] });
      expect(screen.getByText('Solo')).toBeInTheDocument();
      expect(screen.getByText(/Showing 1 of 1 rows/)).toBeInTheDocument();
    });

    it('handles row with missing fields gracefully', () => {
      renderGrid({
        data: [{ name: 'Partial' }],
      });
      expect(screen.getByText('Partial')).toBeInTheDocument();
      // Missing email and status should not crash
    });

    it('handles many columns', () => {
      const cols: VirtualGridColumn[] = Array.from({ length: 20 }, (_, i) => ({
        header: `Col${i}`,
        accessorKey: `field${i}`,
      }));
      const data = [Object.fromEntries(cols.map((c, i) => [c.accessorKey, `val${i}`]))];

      renderGrid({ columns: cols, data });
      expect(screen.getByText('Col0')).toBeInTheDocument();
      expect(screen.getByText('Col19')).toBeInTheDocument();
      expect(screen.getByText('val0')).toBeInTheDocument();
      expect(screen.getByText('val19')).toBeInTheDocument();
    });

    it('handles data with null/undefined field values', () => {
      renderGrid({
        data: [{ name: null, email: undefined, status: 'ok' }],
      });
      expect(screen.getByText('ok')).toBeInTheDocument();
    });

    it('handles data with numeric values', () => {
      const cols: VirtualGridColumn[] = [
        { header: 'ID', accessorKey: 'id' },
        { header: 'Score', accessorKey: 'score' },
      ];
      renderGrid({
        columns: cols,
        data: [{ id: 1, score: 99.5 }],
      });
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('99.5')).toBeInTheDocument();
    });

    it('handles data with boolean values', () => {
      const cols: VirtualGridColumn[] = [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Active', accessorKey: 'active' },
      ];
      renderGrid({
        columns: cols,
        data: [{ name: 'Test', active: true }],
      });
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Custom className support
  // ---------------------------------------------------------------
  describe('className support in states', () => {
    it('applies className to empty grid', () => {
      const { container } = renderGrid({ data: [], className: 'my-grid' });
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveClass('my-grid');
    });

    it('applies className to populated grid', () => {
      const { container } = renderGrid({
        data: [{ name: 'A', email: 'a@t.com', status: 'ok' }],
        className: 'styled-grid',
      });
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveClass('styled-grid');
    });
  });
});
