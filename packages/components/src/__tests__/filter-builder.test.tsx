/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBuilder } from '../custom/filter-builder';

// Mock crypto.randomUUID for deterministic test IDs
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `test-uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
});

const selectFields = [
  {
    value: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
  },
  {
    value: 'name',
    label: 'Name',
    type: 'text',
  },
];

const lookupFields = [
  {
    value: 'account',
    label: 'Account',
    type: 'lookup',
    options: [
      { value: 'acme', label: 'Acme Corp' },
      { value: 'globex', label: 'Globex' },
      { value: 'soylent', label: 'Soylent Corp' },
    ],
  },
];

describe('FilterBuilder', () => {
  describe('lookup field type', () => {
    it('renders without error for lookup fields', () => {
      const onChange = vi.fn();
      const { container } = render(
        <FilterBuilder
          fields={lookupFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'account', operator: 'equals', value: '' },
            ],
          }}
          onChange={onChange}
        />,
      );

      // Should render the filter condition row
      expect(container.querySelector('.space-y-3')).toBeInTheDocument();
    });

    it('renders multi-select checkboxes for lookup field with "in" operator', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={lookupFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'account', operator: 'in', value: [] },
            ],
          }}
          onChange={onChange}
        />,
      );

      // Should render checkboxes for lookup options
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Globex')).toBeInTheDocument();
      expect(screen.getByText('Soylent Corp')).toBeInTheDocument();
    });
  });

  describe('multi-select with in/notIn operator', () => {
    it('renders checkbox list for select field with "in" operator', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={selectFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'status', operator: 'in', value: [] },
            ],
          }}
          onChange={onChange}
        />,
      );

      // Should render checkboxes for all options
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('checks selected items in multi-select', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={selectFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'status', operator: 'in', value: ['active', 'pending'] },
            ],
          }}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      // Active and Pending should be checked
      expect(checkboxes[0]).toBeChecked(); // Active
      expect(checkboxes[1]).not.toBeChecked(); // Inactive
      expect(checkboxes[2]).toBeChecked(); // Pending
    });

    it('adds value when checkbox is checked', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={selectFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'status', operator: 'in', value: ['active'] },
            ],
          }}
          onChange={onChange}
        />,
      );

      // Click the unchecked Inactive checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Inactive

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      const condition = lastCall.conditions[0];
      expect(condition.value).toEqual(['active', 'inactive']);
    });

    it('removes value when checkbox is unchecked', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={selectFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'status', operator: 'in', value: ['active', 'inactive'] },
            ],
          }}
          onChange={onChange}
        />,
      );

      // Click the checked Active checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Active

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      const condition = lastCall.conditions[0];
      expect(condition.value).toEqual(['inactive']);
    });

    it('renders checkbox list for notIn operator', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={selectFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'status', operator: 'notIn', value: [] },
            ],
          }}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
    });

    it('does not render checkboxes for equals operator (single select)', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={selectFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'status', operator: 'equals', value: '' },
            ],
          }}
          onChange={onChange}
        />,
      );

      // Should NOT render checkboxes (single select via Select component)
      expect(screen.queryAllByRole('checkbox').length).toBe(0);
    });
  });

  describe('currency/percent/rating fields use number input', () => {
    const numericFields = [
      { value: 'amount', label: 'Amount', type: 'currency' },
      { value: 'rate', label: 'Rate', type: 'percent' },
      { value: 'score', label: 'Score', type: 'rating' },
    ];

    it('renders number input for currency field', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={numericFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'amount', operator: 'equals', value: '' },
            ],
          }}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Value') as HTMLInputElement;
      expect(input.type).toBe('number');
    });

    it('renders number input for percent field', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={numericFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'rate', operator: 'equals', value: '' },
            ],
          }}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Value') as HTMLInputElement;
      expect(input.type).toBe('number');
    });
  });

  describe('datetime/time fields use appropriate input types', () => {
    const dateTimeFields = [
      { value: 'created_at', label: 'Created At', type: 'datetime' },
      { value: 'start_time', label: 'Start Time', type: 'time' },
    ];

    it('renders datetime-local input for datetime field', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={dateTimeFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'created_at', operator: 'equals', value: '' },
            ],
          }}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Value') as HTMLInputElement;
      expect(input.type).toBe('datetime-local');
    });

    it('renders time input for time field', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={dateTimeFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'start_time', operator: 'equals', value: '' },
            ],
          }}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Value') as HTMLInputElement;
      expect(input.type).toBe('time');
    });
  });

  describe('status field uses select operators and dropdown', () => {
    const statusFields = [
      {
        value: 'pipeline',
        label: 'Pipeline Stage',
        type: 'status',
        options: [
          { value: 'lead', label: 'Lead' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'won', label: 'Won' },
        ],
      },
    ];

    it('renders multi-select checkboxes for status field with "in" operator', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={statusFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'pipeline', operator: 'in', value: [] },
            ],
          }}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
      expect(screen.getByText('Lead')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
      expect(screen.getByText('Won')).toBeInTheDocument();
    });
  });

  describe('user/owner field uses lookup operators and dropdown', () => {
    const userFields = [
      {
        value: 'assigned_to',
        label: 'Assigned To',
        type: 'user',
        options: [
          { value: 'user1', label: 'Alice' },
          { value: 'user2', label: 'Bob' },
        ],
      },
    ];

    it('renders multi-select checkboxes for user field with "in" operator', () => {
      const onChange = vi.fn();
      render(
        <FilterBuilder
          fields={userFields}
          value={{
            id: 'root',
            logic: 'and',
            conditions: [
              { id: 'c1', field: 'assigned_to', operator: 'in', value: [] },
            ],
          }}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(2);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });
});
