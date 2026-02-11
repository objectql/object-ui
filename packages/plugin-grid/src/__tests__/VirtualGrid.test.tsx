/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { VirtualGridColumn, VirtualGridProps } from '../VirtualGrid';

// --- Mock @tanstack/react-virtual ---
// The vitest setup file pre-loads @object-ui/plugin-grid which caches the
// real virtualizer. We call vi.resetModules() in beforeEach so that the
// dynamic import of VirtualGrid picks up our mock instead.
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

// --- Test helpers ---
const sampleColumns: VirtualGridColumn[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Email', accessorKey: 'email' },
  { header: 'Age', accessorKey: 'age' },
];

const sampleData = [
  { name: 'Alice', email: 'alice@test.com', age: 30 },
  { name: 'Bob', email: 'bob@test.com', age: 25 },
  { name: 'Charlie', email: 'charlie@test.com', age: 40 },
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

// =========================================================================
// 1. Basic rendering
// =========================================================================
describe('VirtualGrid: basic rendering', () => {
  it('renders column headers', () => {
    renderGrid();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('renders row cell values', () => {
    renderGrid();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('renders footer with row count', () => {
    renderGrid();

    expect(
      screen.getByText(/Showing 3 of 3 rows/),
    ).toBeInTheDocument();
  });
});

// =========================================================================
// 2. Empty data
// =========================================================================
describe('VirtualGrid: empty data', () => {
  it('renders headers with no rows when data is empty', () => {
    renderGrid({ data: [] });

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText(/Showing 0 of 0 rows/)).toBeInTheDocument();
  });

  it('does not render any data cells when data is empty', () => {
    renderGrid({ data: [] });

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });
});

// =========================================================================
// 3. Custom className / headerClassName
// =========================================================================
describe('VirtualGrid: className support', () => {
  it('applies custom className to the root element', () => {
    const { container } = renderGrid({ className: 'my-custom-grid' });
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('my-custom-grid');
  });

  it('applies headerClassName to the header row', () => {
    const { container } = renderGrid({ headerClassName: 'header-custom' });
    const headerRow = container.querySelector('.header-custom');
    expect(headerRow).toBeInTheDocument();
  });

  it('uses empty className by default', () => {
    const { container } = renderGrid();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('');
  });
});

// =========================================================================
// 4. Column alignment
// =========================================================================
describe('VirtualGrid: column alignment', () => {
  it('defaults to left alignment', () => {
    renderGrid({
      columns: [{ header: 'Name', accessorKey: 'name' }],
      data: [{ name: 'Alice' }],
    });

    expect(screen.getByText('Name')).toHaveClass('text-left');
  });

  it('applies center alignment to header and cells', () => {
    renderGrid({
      columns: [{ header: 'Count', accessorKey: 'count', align: 'center' }],
      data: [{ count: 42 }],
    });

    expect(screen.getByText('Count')).toHaveClass('text-center');
    expect(screen.getByText('42')).toHaveClass('text-center');
    expect(screen.getByText('42')).toHaveClass('justify-center');
  });

  it('applies right alignment to header and cells', () => {
    renderGrid({
      columns: [{ header: 'Price', accessorKey: 'price', align: 'right' }],
      data: [{ price: 99 }],
    });

    expect(screen.getByText('Price')).toHaveClass('text-right');
    expect(screen.getByText('99')).toHaveClass('text-right');
    expect(screen.getByText('99')).toHaveClass('justify-end');
  });
});

// =========================================================================
// 5. Custom cell renderer
// =========================================================================
describe('VirtualGrid: custom cell renderer', () => {
  it('uses custom cell function when provided', () => {
    renderGrid({
      columns: [
        {
          header: 'Name',
          accessorKey: 'name',
          cell: (value: string) => <strong data-testid="bold-name">{value.toUpperCase()}</strong>,
        },
      ],
      data: [{ name: 'Alice' }],
    });

    const cell = screen.getByTestId('bold-name');
    expect(cell).toBeInTheDocument();
    expect(cell.tagName).toBe('STRONG');
    expect(cell).toHaveTextContent('ALICE');
  });

  it('passes both value and row to custom cell function', () => {
    const cellFn = vi.fn((_value, row) => (
      <span data-testid="composite">{row.name} ({row.age})</span>
    ));

    renderGrid({
      columns: [{ header: 'Info', accessorKey: 'name', cell: cellFn }],
      data: [{ name: 'Alice', age: 30 }],
    });

    expect(cellFn).toHaveBeenCalledWith('Alice', { name: 'Alice', age: 30 });
    expect(screen.getByTestId('composite')).toHaveTextContent('Alice (30)');
  });

  it('renders raw value when no cell function is provided', () => {
    renderGrid({
      columns: [{ header: 'Name', accessorKey: 'name' }],
      data: [{ name: 'Bob' }],
    });

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});

// =========================================================================
// 6. Column widths
// =========================================================================
describe('VirtualGrid: column widths', () => {
  it('uses 1fr default when no width specified', () => {
    const { container } = renderGrid({
      columns: [
        { header: 'A', accessorKey: 'a' },
        { header: 'B', accessorKey: 'b' },
      ],
      data: [{ a: '1', b: '2' }],
    });

    const headerRow = container.querySelector('.grid.border-b.sticky') as HTMLElement;
    expect(headerRow.style.gridTemplateColumns).toBe('1fr 1fr');
  });

  it('applies custom column widths', () => {
    const { container } = renderGrid({
      columns: [
        { header: 'A', accessorKey: 'a', width: 200 },
        { header: 'B', accessorKey: 'b', width: '2fr' },
      ],
      data: [{ a: '1', b: '2' }],
    });

    const headerRow = container.querySelector('.grid.border-b.sticky') as HTMLElement;
    expect(headerRow.style.gridTemplateColumns).toBe('200 2fr');
  });
});

// =========================================================================
// 7. Row click handler
// =========================================================================
describe('VirtualGrid: onRowClick', () => {
  it('calls onRowClick with row data and index when row is clicked', () => {
    const onRowClick = vi.fn();
    renderGrid({ onRowClick });

    const aliceCell = screen.getByText('Alice');
    const row = aliceCell.closest('[style*="position: absolute"]') as HTMLElement;
    fireEvent.click(row);

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(
      { name: 'Alice', email: 'alice@test.com', age: 30 },
      0,
    );
  });

  it('passes correct index for different rows', () => {
    const onRowClick = vi.fn();
    renderGrid({ onRowClick });

    const charlieCell = screen.getByText('Charlie');
    const row = charlieCell.closest('[style*="position: absolute"]') as HTMLElement;
    fireEvent.click(row);

    expect(onRowClick).toHaveBeenCalledWith(
      { name: 'Charlie', email: 'charlie@test.com', age: 40 },
      2,
    );
  });

  it('does not error when onRowClick is not provided', () => {
    renderGrid();
    const aliceCell = screen.getByText('Alice');
    const row = aliceCell.closest('[style*="position: absolute"]') as HTMLElement;

    expect(() => fireEvent.click(row)).not.toThrow();
  });
});

// =========================================================================
// 8. Row className (static and dynamic)
// =========================================================================
describe('VirtualGrid: rowClassName', () => {
  it('applies static rowClassName to all rows', () => {
    renderGrid({ rowClassName: 'row-highlight' });

    const aliceCell = screen.getByText('Alice');
    const row = aliceCell.closest('[style*="position: absolute"]') as HTMLElement;
    expect(row).toHaveClass('row-highlight');
  });

  it('applies dynamic rowClassName function', () => {
    renderGrid({
      rowClassName: (_row, index) => (index % 2 === 0 ? 'even-row' : 'odd-row'),
    });

    const aliceRow = screen.getByText('Alice').closest('[style*="position: absolute"]') as HTMLElement;
    expect(aliceRow).toHaveClass('even-row');

    const bobRow = screen.getByText('Bob').closest('[style*="position: absolute"]') as HTMLElement;
    expect(bobRow).toHaveClass('odd-row');
  });

  it('defaults to empty string when rowClassName is not provided', () => {
    renderGrid();
    const row = screen.getByText('Alice').closest('[style*="position: absolute"]') as HTMLElement;
    expect(row.className).toContain('grid');
    expect(row.className).toContain('border-b');
  });
});

// =========================================================================
// 9. Virtual scrolling props
// =========================================================================
describe('VirtualGrid: virtual scrolling configuration', () => {
  it('uses default height of 600px', () => {
    const { container } = renderGrid();
    const scrollContainer = container.querySelector('.overflow-auto') as HTMLElement;
    expect(scrollContainer.style.height).toBe('600px');
  });

  it('accepts numeric height', () => {
    const { container } = renderGrid({ height: 400 });
    const scrollContainer = container.querySelector('.overflow-auto') as HTMLElement;
    expect(scrollContainer.style.height).toBe('400px');
  });

  it('accepts string height', () => {
    const { container } = renderGrid({ height: '80vh' });
    const scrollContainer = container.querySelector('.overflow-auto') as HTMLElement;
    expect(scrollContainer.style.height).toBe('80vh');
  });

  it('renders a relative-positioned inner container for virtual positioning', () => {
    const { container } = renderGrid();
    const innerContainer = container.querySelector(
      '.overflow-auto > div',
    ) as HTMLElement;
    expect(innerContainer.style.position).toBe('relative');
    expect(innerContainer.style.width).toBe('100%');
  });

  it('positions rows absolutely with translateY', () => {
    renderGrid({ rowHeight: 50 });

    const aliceRow = screen.getByText('Alice').closest(
      '[style*="position: absolute"]',
    ) as HTMLElement;
    expect(aliceRow.style.position).toBe('absolute');
    expect(aliceRow.style.transform).toBe('translateY(0px)');

    const bobRow = screen.getByText('Bob').closest(
      '[style*="position: absolute"]',
    ) as HTMLElement;
    expect(bobRow.style.transform).toBe('translateY(50px)');
  });

  it('sets total height on inner container based on data length and row height', () => {
    const { container } = renderGrid({ rowHeight: 50 });
    const innerContainer = container.querySelector(
      '.overflow-auto > div',
    ) as HTMLElement;
    // 3 rows × 50px = 150px
    expect(innerContainer.style.height).toBe('150px');
  });
});

// =========================================================================
// 10. Different data types and edge cases
// =========================================================================
describe('VirtualGrid: different column types', () => {
  it('renders numeric values correctly', () => {
    renderGrid({
      columns: [{ header: 'Count', accessorKey: 'count' }],
      data: [{ count: 0 }, { count: 100 }, { count: -5 }],
    });

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
  });

  it('handles null / undefined values gracefully', () => {
    renderGrid({
      columns: [
        { header: 'Name', accessorKey: 'name' },
        { header: 'Email', accessorKey: 'email' },
      ],
      data: [
        { name: 'Alice', email: null },
        { name: undefined, email: 'bob@test.com' },
      ],
    });

    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 2 rows/)).toBeInTheDocument();
  });

  it('renders many columns without error', () => {
    const cols: VirtualGridColumn[] = Array.from({ length: 10 }, (_, i) => ({
      header: `Col ${i}`,
      accessorKey: `field${i}`,
    }));
    const data = [Object.fromEntries(cols.map((c) => [c.accessorKey, `val-${c.accessorKey}`]))];

    renderGrid({ columns: cols, data });

    expect(screen.getByText('Col 0')).toBeInTheDocument();
    expect(screen.getByText('Col 9')).toBeInTheDocument();
    expect(screen.getByText('val-field5')).toBeInTheDocument();
  });

  it('applies gridTemplateColumns to each data row matching header', () => {
    const { container } = renderGrid({
      columns: [
        { header: 'A', accessorKey: 'a', width: '100px' },
        { header: 'B', accessorKey: 'b', width: '200px' },
      ],
      data: [{ a: '1', b: '2' }],
    });

    const dataRow = container.querySelector('[style*="position: absolute"]') as HTMLElement;
    expect(dataRow.style.gridTemplateColumns).toBe('100px 200px');
  });
});
