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

  describe('column chooser (defaultHidden columns)', () => {
    const withHidden = {
      columns: [
        { field: 'title', label: 'Title', type: 'text' as const, required: true },
        { field: 'amount', label: 'Amount', type: 'currency' as const },
        { field: 'notes', label: 'Notes', type: 'text' as const, defaultHidden: true },
      ],
    } as any;

    it('hides defaultHidden columns by default but keeps required/visible ones', () => {
      render(<GridField value={[]} onChange={() => {}} field={withHidden} />);
      expect(screen.getByText('Title')).toBeTruthy();
      expect(screen.getByText('Amount')).toBeTruthy();
      expect(screen.queryByText('Notes')).toBeNull(); // collapsed into the chooser
      expect(screen.getByTestId('line-items-columns')).toBeTruthy();
    });

    it('reveals an optional column when toggled in the chooser', () => {
      render(<GridField value={[]} onChange={() => {}} field={withHidden} />);
      fireEvent.click(screen.getByTestId('line-items-columns'));
      fireEvent.click(screen.getByLabelText('Notes'));
      expect(screen.getAllByText('Notes').length).toBeGreaterThan(0);
    });

    it('shows no chooser when there are no optional columns', () => {
      render(<GridField value={[]} onChange={() => {}} field={field} />);
      expect(screen.queryByTestId('line-items-columns')).toBeNull();
    });
  });

  describe('list mode (displayMode="list" — form-factor for fat children)', () => {
    const listField = {
      columns: [
        { field: 'title', label: 'Title', type: 'text' as const, required: true },
        { field: 'status', label: 'Status', type: 'select' as const, options: [{ label: 'To Do', value: 'todo' }] },
      ],
    } as any;

    it('renders rows read-only (no cell inputs) and an Add button', () => {
      const onAdd = vi.fn();
      render(
        <GridField
          value={[{ title: 'Ship it', status: 'todo' }]}
          onChange={() => {}}
          field={listField}
          displayMode="list"
          onRowExpand={() => {}}
          onAdd={onAdd}
        />,
      );
      // Read-only display: the status renders its option label, not a combobox.
      expect(screen.getByText('To Do')).toBeTruthy();
      expect(screen.queryByLabelText('Title')).toBeNull(); // no editable input
      expect(screen.getByRole('button', { name: /Open row/i })).toBeTruthy(); // per-row edit
    });

    it('Add calls onAdd (host opens the full form) instead of inserting a blank row', () => {
      const onAdd = vi.fn();
      const onChange = vi.fn();
      render(
        <GridField value={[]} onChange={onChange} field={listField} displayMode="list" onRowExpand={() => {}} onAdd={onAdd} />,
      );
      fireEvent.click(screen.getByTestId('line-items-add'));
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled(); // did NOT insert a blank inline row
    });
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
