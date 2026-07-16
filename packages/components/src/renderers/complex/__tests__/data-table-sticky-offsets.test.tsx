/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression: pinned leading cells (checkbox / row number / frozen data
 * columns) must stick at the CUMULATIVE MEASURED widths of the cells before
 * them, not at hardcoded 40px estimates. Bug context (titanwind-ehr#418): the
 * table's auto layout collapsed the checkbox column to its ~28px min-content
 * while the row-number cell stuck at `left: 40px`, leaving a ~12px uncovered
 * strip between them where horizontally scrolled cells showed through.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import '../data-table';

/** Header-cell widths the mocked layout reports (checkbox, #, then data columns). */
const HEADER_WIDTHS = [28, 47, 160, 140, 120];

function mockRect(width: number): DOMRect {
  return {
    width, height: 40, top: 0, left: 0, bottom: 40, right: width, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

const originalGetRect = HTMLElement.prototype.getBoundingClientRect;

function renderTable(schema: any) {
  const DataTable = ComponentRegistry.get('data-table') as any;
  if (!DataTable) throw new Error('data-table not registered');
  return render(<DataTable schema={schema} />);
}

const schema = {
  data: [
    { id: '1', code: 'PP-001', product: 'Tower T1', island: 'Welding' },
    { id: '2', code: 'PP-002', product: 'Tower T1', island: 'Welding' },
  ],
  pagination: false,
  searchable: false,
  selectable: true,
  showRowNumbers: true,
  frozenColumns: 1,
  columns: [
    { header: 'Code', accessorKey: 'code', width: 160 },
    { header: 'Product', accessorKey: 'product', width: 140 },
    { header: 'Island', accessorKey: 'island', width: 120 },
  ],
};

describe('data-table sticky offsets follow measured header widths', () => {
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.tagName === 'TH' && this.parentElement) {
          const index = Array.prototype.indexOf.call(this.parentElement.children, this);
          return mockRect(HEADER_WIDTHS[index] ?? 100);
        }
        return originalGetRect.call(this);
      },
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('pins the row-number and frozen data cells at cumulative measured widths', () => {
    const { container } = renderTable(schema);

    const headCells = container.querySelectorAll('thead th');
    // Checkbox header sticks at the container edge via the `left-0` utility.
    expect(headCells[0].className).toContain('left-0');
    // Row-number header sticks right after the MEASURED 28px checkbox column
    // (the pre-fix hardcoded 40px left a 12px show-through strip).
    expect((headCells[1] as HTMLElement).style.left).toBe('28px');
    // First frozen data column sticks after checkbox (28) + row number (47).
    expect((headCells[2] as HTMLElement).style.left).toBe('75px');

    const bodyCells = document.querySelectorAll('tbody tr')[0].querySelectorAll('td');
    expect(bodyCells[0].className).toContain('left-0');
    expect((bodyCells[1] as HTMLElement).style.left).toBe('28px');
    expect((bodyCells[2] as HTMLElement).style.left).toBe('75px');
  });

  it('keeps non-sticky layout untouched when nothing is frozen', () => {
    const { container } = renderTable({ ...schema, frozenColumns: 0 });
    const headCells = container.querySelectorAll('thead th');
    expect(headCells[1].className).not.toContain('sticky');
    expect((headCells[1] as HTMLElement).style.left).toBe('');
  });
});
