/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PivotTable } from '../PivotTable';
import type { PivotTableSchema } from '@object-ui/types';

const SAMPLE_DATA = [
  { owner: 'Alice', stage: 'Discovery', amount: 1000 },
  { owner: 'Alice', stage: 'Proposal', amount: 2000 },
  { owner: 'Alice', stage: 'Discovery', amount: 500 },
  { owner: 'Bob', stage: 'Discovery', amount: 3000 },
  { owner: 'Bob', stage: 'Closed', amount: 5000 },
  { owner: 'Carol', stage: 'Proposal', amount: 4000 },
];

function makeSchema(overrides?: Partial<PivotTableSchema>): PivotTableSchema {
  return {
    type: 'pivot',
    rowField: 'owner',
    columnField: 'stage',
    valueField: 'amount',
    data: SAMPLE_DATA,
    ...overrides,
  };
}

describe('PivotTable', () => {
  it('should render row and column headers', () => {
    render(<PivotTable schema={makeSchema()} />);

    // Row headers
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();

    // Column headers
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('should aggregate values with sum by default', () => {
    render(<PivotTable schema={makeSchema()} />);

    // Alice + Discovery = 1000 + 500 = 1500
    expect(screen.getByText('1500')).toBeInTheDocument();
    // Alice + Proposal = 2000
    expect(screen.getByText('2000')).toBeInTheDocument();
    // Bob + Discovery = 3000
    expect(screen.getByText('3000')).toBeInTheDocument();
    // Bob + Closed = 5000
    expect(screen.getByText('5000')).toBeInTheDocument();
    // Carol + Proposal = 4000
    expect(screen.getByText('4000')).toBeInTheDocument();
  });

  it('should support count aggregation', () => {
    render(<PivotTable schema={makeSchema({ aggregation: 'count' })} />);

    // Alice + Discovery = 2 items
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should support avg aggregation', () => {
    render(<PivotTable schema={makeSchema({ aggregation: 'avg' })} />);

    // Alice + Discovery = avg(1000, 500) = 750
    expect(screen.getByText('750')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(<PivotTable schema={makeSchema({ title: 'Revenue Pivot' })} />);

    expect(screen.getByText('Revenue Pivot')).toBeInTheDocument();
  });

  it('should show row totals when showRowTotals is true', () => {
    render(<PivotTable schema={makeSchema({ showRowTotals: true })} />);

    // Header "Total" column
    const totalHeaders = screen.getAllByText('Total');
    expect(totalHeaders.length).toBeGreaterThanOrEqual(1);

    // Alice total = 1000 + 2000 + 500 = 3500
    expect(screen.getByText('3500')).toBeInTheDocument();
    // Bob total = 3000 + 5000 = 8000
    expect(screen.getByText('8000')).toBeInTheDocument();
  });

  it('should show column totals when showColumnTotals is true', () => {
    render(<PivotTable schema={makeSchema({ showColumnTotals: true })} />);

    // Footer row with "Total" label
    const totalCells = screen.getAllByText('Total');
    expect(totalCells.length).toBeGreaterThanOrEqual(1);

    // Discovery total = 1000 + 500 + 3000 = 4500
    expect(screen.getByText('4500')).toBeInTheDocument();
    // Proposal total = 2000 + 4000 = 6000
    expect(screen.getByText('6000')).toBeInTheDocument();
  });

  it('should show grand total when both row and column totals are enabled', () => {
    render(<PivotTable schema={makeSchema({ showRowTotals: true, showColumnTotals: true })} />);

    // Grand total = 1000 + 2000 + 500 + 3000 + 5000 + 4000 = 15500
    expect(screen.getByText('15500')).toBeInTheDocument();
  });

  it('should apply format string', () => {
    render(<PivotTable schema={makeSchema({ format: '$,.0f' })} />);

    // Alice + Discovery = $1,500
    expect(screen.getByText('$1,500')).toBeInTheDocument();
    // Bob + Closed = $5,000
    expect(screen.getByText('$5,000')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    const { container } = render(<PivotTable schema={makeSchema({ data: [] })} />);

    // Should render a table with header row but no body rows
    const tbody = container.querySelector('tbody');
    expect(tbody).toBeInTheDocument();
    expect(tbody!.children.length).toBe(0);
  });

  it('should handle missing values in data as 0', () => {
    const data = [
      { owner: 'Alice', stage: 'A', amount: 10 },
      { owner: 'Bob', stage: 'B', amount: 20 },
    ];
    render(<PivotTable schema={makeSchema({ data })} />);

    // Alice × B = 0, Bob × A = 0 should appear
    const zeroCells = screen.getAllByText('0');
    expect(zeroCells.length).toBe(2);
  });
});
