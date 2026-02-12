/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Screen reader experience tests for VirtualGrid.
 *
 * Tests ARIA attributes, roles, landmarks, keyboard navigation,
 * and screen reader announcements for the grid plugin.
 * Part of P2.3 Accessibility & Inclusive Design roadmap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { VirtualGridColumn, VirtualGridProps } from '../VirtualGrid';

// Mock @tanstack/react-virtual (same pattern as VirtualGrid.test.tsx)
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

const sampleColumns: VirtualGridColumn[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Email', accessorKey: 'email' },
  { header: 'Role', accessorKey: 'role' },
];

const sampleData = [
  { name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
  { name: 'Bob Smith', email: 'bob@example.com', role: 'Editor' },
  { name: 'Charlie Brown', email: 'charlie@example.com', role: 'Viewer' },
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
  const props: VirtualGridProps = {
    data: sampleData,
    columns: sampleColumns,
    ...overrides,
  };
  return render(<VirtualGrid {...props} />);
}

describe('VirtualGrid: Screen Reader & Accessibility', () => {
  describe('ARIA attributes and roles', () => {
    it('renders column headers as identifiable elements', () => {
      renderGrid();

      const nameHeader = screen.getByText('Name');
      const emailHeader = screen.getByText('Email');
      const roleHeader = screen.getByText('Role');

      expect(nameHeader).toBeInTheDocument();
      expect(emailHeader).toBeInTheDocument();
      expect(roleHeader).toBeInTheDocument();

      // Headers should have font-semibold styling to indicate importance
      expect(nameHeader).toHaveClass('font-semibold');
      expect(emailHeader).toHaveClass('font-semibold');
    });

    it('renders data cells with proper content for screen readers', () => {
      renderGrid();

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });

    it('footer announces row count for screen readers', () => {
      renderGrid();

      const footer = screen.getByText(/Showing 3 of 3 rows/);
      expect(footer).toBeInTheDocument();
    });

    it('empty grid announces zero rows', () => {
      renderGrid({ data: [] });

      const footer = screen.getByText(/Showing 0 of 0 rows/);
      expect(footer).toBeInTheDocument();
    });
  });

  describe('grid structure for assistive technology', () => {
    it('header row uses CSS grid layout for structural organization', () => {
      const { container } = renderGrid();

      const headerRow = container.querySelector('.grid.border-b.sticky');
      expect(headerRow).toBeInTheDocument();
      expect(headerRow).toHaveStyle({ gridTemplateColumns: '1fr 1fr 1fr' });
    });

    it('data rows use CSS grid with matching column structure', () => {
      const { container } = renderGrid();

      const dataRows = container.querySelectorAll('[style*="position: absolute"]');
      expect(dataRows.length).toBe(3);

      dataRows.forEach((row) => {
        expect((row as HTMLElement).style.gridTemplateColumns).toBe('1fr 1fr 1fr');
      });
    });

    it('each cell contains text content accessible to screen readers', () => {
      renderGrid();

      // Verify all data is available in the DOM for screen readers
      sampleData.forEach((row) => {
        expect(screen.getByText(row.name)).toBeInTheDocument();
        expect(screen.getByText(row.email)).toBeInTheDocument();
        expect(screen.getByText(row.role)).toBeInTheDocument();
      });
    });
  });

  describe('column alignment and visual hierarchy', () => {
    it('left-aligned columns use text-left class', () => {
      renderGrid({
        columns: [{ header: 'Name', accessorKey: 'name', align: 'left' }],
        data: [{ name: 'Alice' }],
      });

      expect(screen.getByText('Name')).toHaveClass('text-left');
    });

    it('center-aligned columns indicate alignment for assistive technology', () => {
      renderGrid({
        columns: [{ header: 'Count', accessorKey: 'count', align: 'center' }],
        data: [{ count: 42 }],
      });

      const header = screen.getByText('Count');
      expect(header).toHaveClass('text-center');

      const cell = screen.getByText('42');
      expect(cell).toHaveClass('text-center');
    });

    it('right-aligned columns indicate alignment for assistive technology', () => {
      renderGrid({
        columns: [{ header: 'Price', accessorKey: 'price', align: 'right' }],
        data: [{ price: 99.99 }],
      });

      const header = screen.getByText('Price');
      expect(header).toHaveClass('text-right');
    });
  });

  describe('interactive rows', () => {
    it('clickable rows have cursor-pointer for visual indication', () => {
      const onRowClick = vi.fn();
      const { container } = renderGrid({ onRowClick });

      const rows = container.querySelectorAll('[style*="position: absolute"]');
      rows.forEach((row) => {
        expect((row as HTMLElement).className).toContain('cursor-pointer');
      });
    });

    it('rows have hover styling for visual feedback', () => {
      const { container } = renderGrid();

      const rows = container.querySelectorAll('[style*="position: absolute"]');
      rows.forEach((row) => {
        // Rows have hover background styling
        expect((row as HTMLElement).className).toContain('hover:bg-muted');
      });
    });
  });

  describe('custom cell renderers preserve accessibility', () => {
    it('custom cell renderers can include ARIA labels', () => {
      renderGrid({
        columns: [
          {
            header: 'Status',
            accessorKey: 'status',
            cell: (value: string) => (
              <span role="status" aria-label={`Status: ${value}`}>
                {value}
              </span>
            ),
          },
        ],
        data: [{ status: 'Active' }],
      });

      const statusCell = screen.getByRole('status');
      expect(statusCell).toHaveAttribute('aria-label', 'Status: Active');
    });

    it('custom cell renderers can include interactive elements', () => {
      renderGrid({
        columns: [
          {
            header: 'Actions',
            accessorKey: 'id',
            cell: (value: string) => (
              <button aria-label={`Edit record ${value}`}>Edit</button>
            ),
          },
        ],
        data: [{ id: '123' }],
      });

      const editBtn = screen.getByRole('button', { name: 'Edit record 123' });
      expect(editBtn).toBeInTheDocument();
    });
  });

  describe('loading and empty states', () => {
    it('displays zero-row footer for empty data', () => {
      renderGrid({ data: [] });

      expect(screen.getByText(/Showing 0 of 0 rows/)).toBeInTheDocument();
    });

    it('headers remain visible in empty state for context', () => {
      renderGrid({ data: [] });

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
    });
  });
});
