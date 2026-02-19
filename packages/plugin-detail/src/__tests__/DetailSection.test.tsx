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

  it('should render boolean fields with badge', () => {
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
});
