import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GridField, LineItemsField, sumColumn } from './GridField';

const columns = [
  { field: 'description', label: 'Description', type: 'text' as const },
  { field: 'amount', label: 'Amount', type: 'currency' as const },
];

const field = { columns, total_field: 'amount' } as any;

describe('GridField / LineItemsField — editable line items', () => {
  it('is exported under both names', () => {
    expect(LineItemsField).toBe(GridField);
  });

  it('renders a column header per config and an empty hint', () => {
    render(<GridField value={[]} onChange={() => {}} field={field} />);
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add line/i })).toBeTruthy();
  });

  it('Add line appends a blank row keyed by columns', () => {
    const onChange = vi.fn();
    render(<GridField value={[]} onChange={onChange} field={field} />);
    fireEvent.click(screen.getByRole('button', { name: /Add line/i }));
    expect(onChange).toHaveBeenCalledWith([{ description: null, amount: null }]);
  });

  it('editing a text cell emits the raw string', () => {
    const onChange = vi.fn();
    render(<GridField value={[{ description: '', amount: null }]} onChange={onChange} field={field} />);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Taxi' } });
    expect(onChange).toHaveBeenCalledWith([{ description: 'Taxi', amount: null }]);
  });

  it('editing a currency cell coerces to a number', () => {
    const onChange = vi.fn();
    render(<GridField value={[{ description: 'Taxi', amount: null }]} onChange={onChange} field={field} />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '42.5' } });
    expect(onChange).toHaveBeenCalledWith([{ description: 'Taxi', amount: 42.5 }]);
  });

  it('removing a row emits the array without it', () => {
    const onChange = vi.fn();
    render(
      <GridField
        value={[{ description: 'A', amount: 1 }, { description: 'B', amount: 2 }]}
        onChange={onChange}
        field={field}
      />,
    );
    const removeButtons = screen.getAllByLabelText('Remove row');
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([{ description: 'B', amount: 2 }]);
  });

  it('readonly mode shows values and a summed total footer', () => {
    render(
      <GridField
        value={[{ description: 'A', amount: 10 }, { description: 'B', amount: 20 }]}
        onChange={() => {}}
        field={field}
        readonly
      />,
    );
    expect(screen.getByTestId('line-items-readonly')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('sumColumn ignores blanks and NaN', () => {
    expect(sumColumn([{ amount: 1 }, { amount: 2 }, { amount: null }], 'amount')).toBe(3);
  });
});
