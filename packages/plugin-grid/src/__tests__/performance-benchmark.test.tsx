/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Performance benchmark tests for VirtualGrid.
 * Part of P2.4 Performance at Scale roadmap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { VirtualGridColumn, VirtualGridProps } from '../VirtualGrid';

// --- Mock @tanstack/react-virtual ---
// Cap the visible window to simulate virtualisation (only render a subset)
const VISIBLE_WINDOW = 50;

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: any) => {
    const count: number = opts.count;
    const size: number = opts.estimateSize();
    const visible = Math.min(count, VISIBLE_WINDOW);
    const items = [];
    for (let i = 0; i < visible; i++) {
      items.push({ index: i, key: String(i), start: i * size, size });
    }
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * size,
    };
  },
}));

// --- Data generators ---
function generateRows(count: number) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      department: `Dept ${i % 10}`,
      salary: 50000 + (i * 100),
    });
  }
  return rows;
}

const benchmarkColumns: VirtualGridColumn[] = [
  { header: 'ID', accessorKey: 'id' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'Email', accessorKey: 'email' },
  { header: 'Department', accessorKey: 'department' },
  { header: 'Salary', accessorKey: 'salary', align: 'right' },
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
    data: [],
    columns: benchmarkColumns,
    ...overrides,
  };
  return render(<VirtualGrid {...props} />);
}

// =========================================================================
// Performance Benchmarks
// =========================================================================

describe('VirtualGrid: performance benchmarks', () => {
  it('renders 1,000 rows under 500ms', () => {
    const data = generateRows(1_000);

    const start = performance.now();
    const { container } = renderGrid({ data });
    const elapsed = performance.now() - start;

    expect(container.querySelector('.overflow-auto')).toBeInTheDocument();
    expect(elapsed).toBeLessThan(500);
  });

  it('renders 10,000 rows under 2,000ms', () => {
    const data = generateRows(10_000);

    const start = performance.now();
    const { container } = renderGrid({ data });
    const elapsed = performance.now() - start;

    expect(container.querySelector('.overflow-auto')).toBeInTheDocument();
    expect(elapsed).toBeLessThan(2_000);
  });

  it('renders 50,000 rows without crashing', () => {
    const data = generateRows(50_000);

    const start = performance.now();
    const { container } = renderGrid({ data });
    const elapsed = performance.now() - start;

    expect(container.querySelector('.overflow-auto')).toBeInTheDocument();
    // Virtual scrolling should keep render time manageable even at 50K
    expect(elapsed).toBeLessThan(10_000);
  });

  it('data generation for 10,000 rows is fast (< 200ms)', () => {
    const start = performance.now();
    const data = generateRows(10_000);
    const elapsed = performance.now() - start;

    expect(data).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(200);
  });
});

// =========================================================================
// Scaling characteristics
// =========================================================================

describe('VirtualGrid: scaling characteristics', () => {
  it('shows correct row count in footer for large dataset', () => {
    const data = generateRows(1_000);
    renderGrid({ data });

    // Footer displays total count regardless of virtualised window
    expect(document.body.textContent).toContain('1000');
  });

  it('renders with many columns (20+) without degradation', () => {
    const columns: VirtualGridColumn[] = Array.from({ length: 20 }, (_, i) => ({
      header: `Col ${i}`,
      accessorKey: `field${i}`,
    }));
    const data = Array.from({ length: 500 }, (_, row) =>
      Object.fromEntries(columns.map((c) => [c.accessorKey, `R${row}-${c.accessorKey}`])),
    );

    const start = performance.now();
    const { container } = renderGrid({ columns, data });
    const elapsed = performance.now() - start;

    expect(container.querySelector('.overflow-auto')).toBeInTheDocument();
    expect(elapsed).toBeLessThan(2_000);
  });

  it('custom cell renderers do not drastically increase render time for 1,000 rows', () => {
    const columnsWithRenderers: VirtualGridColumn[] = [
      {
        header: 'Name',
        accessorKey: 'name',
        cell: (value: string) => <strong>{value}</strong>,
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: (value: string) => <a href={`mailto:${value}`}>{value}</a>,
      },
      { header: 'Department', accessorKey: 'department' },
    ];
    const data = generateRows(1_000);

    const start = performance.now();
    renderGrid({ columns: columnsWithRenderers, data });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1_000);
  });
});
