/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailSection } from '../DetailSection';

describe('DetailSection', () => {
  it('should render text fields as plain text', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'name', label: 'Name', type: 'text' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ name: 'Alice' }} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render date fields formatted (not raw ISO)', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'order_date', label: 'Order Date', type: 'date' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ order_date: '2024-01-15T00:00:00.000Z' }} />);
    // Should NOT show raw ISO string
    expect(screen.queryByText('2024-01-15T00:00:00.000Z')).not.toBeInTheDocument();
    // Should show formatted date (e.g. "Jan 15, 2024")
    expect(screen.getByText(/Jan/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('should render currency fields formatted', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'total_amount', label: 'Total Amount', type: 'currency' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ total_amount: 15459.99 }} />);
    // Should NOT show plain number
    expect(screen.queryByText('15459.99')).not.toBeInTheDocument();
    // Should show formatted currency (e.g. "$15,459.99")
    expect(screen.getByText(/15,459\.99/)).toBeInTheDocument();
  });

  it('should render boolean fields with checkbox', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'active', label: 'Active', type: 'boolean' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ active: true }} />);
    // BooleanCellRenderer renders a checkbox
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('should render select fields as badge', () => {
    const section = {
      title: 'Info',
      fields: [
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'Draft', label: 'Draft', color: 'yellow' },
            { value: 'Active', label: 'Active', color: 'green' },
          ],
        },
      ],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ status: 'Draft' }} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should render null/undefined values as dash', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'missing', label: 'Missing', type: 'text' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{}} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render section title', () => {
    const section = {
      title: 'Basic Information',
      fields: [{ name: 'name', label: 'Name' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ name: 'Test' }} />);
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('should auto-infer 2 columns when columns is not set and 5+ fields exist', () => {
    const section = {
      title: 'Auto Layout',
      fields: Array.from({ length: 6 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    // The grid container should have the sm:grid-cols-2 class
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('sm:grid-cols-2');
  });

  it('should auto-infer 3 columns when columns is not set and 11+ fields exist', () => {
    const section = {
      title: 'Many Fields',
      fields: Array.from({ length: 12 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('md:grid-cols-3');
  });

  it('should keep 1 column when columns is not set and ≤3 fields exist', () => {
    const section = {
      title: 'Few Fields',
      fields: [
        { name: 'a', label: 'A', type: 'text' },
        { name: 'b', label: 'B', type: 'text' },
      ],
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('grid-cols-1');
    expect(grid!.className).not.toContain('sm:grid-cols-2');
  });

  it('should respect explicit columns=1 even with many fields', () => {
    const section = {
      title: 'Forced Single Column',
      fields: Array.from({ length: 15 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
      columns: 1,
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('grid-cols-1');
    expect(grid!.className).not.toContain('sm:grid-cols-2');
  });
});
