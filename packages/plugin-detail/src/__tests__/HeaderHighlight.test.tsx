/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderHighlight } from '../HeaderHighlight';
import type { HighlightField } from '@object-ui/types';

describe('HeaderHighlight', () => {
  const fields: HighlightField[] = [
    { name: 'revenue', label: 'Annual Revenue' },
    { name: 'employees', label: 'Employees' },
    { name: 'industry', label: 'Industry' },
  ];

  const data = {
    revenue: '$5M',
    employees: 150,
    industry: 'Technology',
  };

  it('should render highlight fields with labels and values', () => {
    render(<HeaderHighlight fields={fields} data={data} />);
    expect(screen.getByText('Annual Revenue')).toBeInTheDocument();
    expect(screen.getByText('$5M')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  it('should not render when no data is provided', () => {
    const { container } = render(<HeaderHighlight fields={fields} />);
    expect(container.innerHTML).toBe('');
  });

  it('should not render when fields array is empty', () => {
    const { container } = render(<HeaderHighlight fields={[]} data={data} />);
    expect(container.innerHTML).toBe('');
  });

  it('should hide fields with null or empty values', () => {
    const sparseData = { revenue: '$5M', employees: null, industry: '' };
    render(<HeaderHighlight fields={fields} data={sparseData} />);
    expect(screen.getByText('$5M')).toBeInTheDocument();
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
    expect(screen.queryByText('Industry')).not.toBeInTheDocument();
  });

  it('should not render when all field values are empty', () => {
    const emptyData = { revenue: null, employees: undefined, industry: '' };
    const { container } = render(<HeaderHighlight fields={fields} data={emptyData} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render icon when provided', () => {
    const fieldsWithIcon: HighlightField[] = [
      { name: 'revenue', label: 'Revenue', icon: '💰' },
    ];
    render(<HeaderHighlight fields={fieldsWithIcon} data={{ revenue: '$5M' }} />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('should render currency fields with formatted value via CellRenderer', () => {
    const currencyFields: HighlightField[] = [
      { name: 'amount', label: 'Amount', type: 'currency' },
    ];
    render(<HeaderHighlight fields={currencyFields} data={{ amount: 250000 }} />);
    // CurrencyCellRenderer should format — should NOT show raw "250000"
    expect(screen.queryByText('250000')).not.toBeInTheDocument();
    expect(screen.getByText(/250,000/)).toBeInTheDocument();
  });

  it('should render select fields as badge via CellRenderer', () => {
    const selectFields: HighlightField[] = [
      { name: 'stage', label: 'Stage', type: 'select' },
    ];
    render(
      <HeaderHighlight
        fields={selectFields}
        data={{ stage: 'prospecting' }}
        objectSchema={{
          fields: {
            stage: {
              type: 'select',
              options: [
                { value: 'prospecting', label: 'Prospecting', color: 'blue' },
              ],
            },
          },
        }}
      />
    );
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
  });

  it('should enrich field type from objectSchema when field.type is not set', () => {
    const fieldsNoType: HighlightField[] = [
      { name: 'amount', label: 'Amount' },
    ];
    render(
      <HeaderHighlight
        fields={fieldsNoType}
        data={{ amount: 5000 }}
        objectSchema={{
          fields: {
            amount: { type: 'currency', currency: 'USD' },
          },
        }}
      />
    );
    // CurrencyCellRenderer should format, not raw String()
    expect(screen.queryByText('5000')).not.toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it('should fall back to text when no type info is available', () => {
    const fieldsNoType: HighlightField[] = [
      { name: 'custom', label: 'Custom' },
    ];
    render(<HeaderHighlight fields={fieldsNoType} data={{ custom: 'raw-value' }} />);
    expect(screen.getByText('raw-value')).toBeInTheDocument();
  });

  it('should safely render object values without crashing (React error #310 guard)', () => {
    // Simulates MongoDB Decimal128 or expanded reference objects
    const fieldsWithNumber: HighlightField[] = [
      { name: 'amount', label: 'Amount' },
      { name: 'account', label: 'Account' },
    ];
    const objectData = {
      amount: { $numberDecimal: '250000' },
      account: { _id: 'abc', name: 'Acme Corp' },
    };
    const objectSchema = {
      fields: {
        amount: { type: 'number' },
        account: { type: 'text' },
      },
    };
    // Should NOT crash — cell renderers coerce values via coerceToSafeValue
    const { container } = render(
      <HeaderHighlight
        fields={fieldsWithNumber}
        data={objectData}
        objectSchema={objectSchema}
      />
    );
    expect(container.innerHTML).not.toBe('');
    // NumberCellRenderer coerces $numberDecimal to number
    expect(screen.getByText('250,000')).toBeInTheDocument();
    // TextCellRenderer extracts name from object
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('should safely render lookup object values via LookupCellRenderer', () => {
    const lookupFields: HighlightField[] = [
      { name: 'owner', label: 'Owner' },
    ];
    const lookupData = {
      owner: { _id: 'u1', name: 'Jane Doe' },
    };
    const objectSchema = {
      fields: {
        owner: { type: 'lookup' },
      },
    };
    // LookupCellRenderer handles object values natively
    render(
      <HeaderHighlight
        fields={lookupFields}
        data={lookupData}
        objectSchema={objectSchema}
      />
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('should safely render array values via TextCellRenderer', () => {
    const arrayFields: HighlightField[] = [
      { name: 'tags', label: 'Tags' },
    ];
    const arrayData = {
      tags: ['urgent', 'follow-up'],
    };
    const { container } = render(
      <HeaderHighlight fields={arrayFields} data={arrayData} />
    );
    expect(container.innerHTML).not.toBe('');
    // TextCellRenderer coerces arrays to comma-separated string
    expect(screen.getByText('urgent, follow-up')).toBeInTheDocument();
  });

  it('should safely render array of objects via TextCellRenderer', () => {
    const arrayFields: HighlightField[] = [
      { name: 'contacts', label: 'Contacts' },
    ];
    const arrayData = {
      contacts: [{ name: 'Alice' }, { name: 'Bob' }],
    };
    const { container } = render(
      <HeaderHighlight fields={arrayFields} data={arrayData} />
    );
    expect(container.innerHTML).not.toBe('');
    // TextCellRenderer coerces array of objects to "Alice, Bob"
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
  });
});
