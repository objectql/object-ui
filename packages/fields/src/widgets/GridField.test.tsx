import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GridField, LineItemsField, sumColumn, lookupAutofillPatch } from './GridField';

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
    // [0] = the data row ([1] would be the always-present trailing ghost row).
    fireEvent.change(screen.getAllByLabelText('Description')[0], { target: { value: 'Taxi' } });
    expect(onChange).toHaveBeenCalledWith([{ description: 'Taxi', amount: null }]);
  });

  it('editing a currency cell coerces to a number', () => {
    const onChange = vi.fn();
    render(<GridField value={[{ description: 'Taxi', amount: null }]} onChange={onChange} field={field} />);
    fireEvent.change(screen.getAllByLabelText('Amount')[0], { target: { value: '42.5' } });
    expect(onChange).toHaveBeenCalledWith([{ description: 'Taxi', amount: 42.5 }]);
  });

  describe('trailing ghost row (start-with-one + auto-append)', () => {
    it('renders a trailing empty row so an empty grid still has one input line', () => {
      render(<GridField value={[]} onChange={() => {}} field={field} />);
      // No "No items" empty-state in grid mode — the ghost row IS the first line.
      expect(screen.getByText('Description')).toBeTruthy();
      expect(screen.getAllByLabelText('Description')).toHaveLength(1); // just the ghost
    });

    it('typing in the ghost row materialises a new row (no Add click needed)', () => {
      const onChange = vi.fn();
      render(<GridField value={[{ description: 'A', amount: 1 }]} onChange={onChange} field={field} />);
      const inputs = screen.getAllByLabelText('Description');
      expect(inputs).toHaveLength(2); // data row + ghost
      fireEvent.change(inputs[1], { target: { value: 'B' } }); // type in the ghost
      expect(onChange).toHaveBeenCalledWith([
        { description: 'A', amount: 1 },
        { description: 'B', amount: null },
      ]);
    });
  });

  describe('computed columns (amount = qty × unit_price)', () => {
    const computedField = {
      columns: [
        { field: 'product', label: 'Product', type: 'text' as const },
        { field: 'quantity', label: 'Qty', type: 'number' as const },
        { field: 'unit_price', label: 'Unit Price', type: 'currency' as const },
        { field: 'amount', label: 'Amount', type: 'currency' as const, computed: true, expr: 'record.quantity * record.unit_price', scale: 2 },
      ],
      total_field: 'amount',
    } as any;

    it('renders a computed column read-only (no input) and recomputes on edit', () => {
      const onChange = vi.fn();
      render(<GridField value={[{ product: 'Widget', quantity: 3, unit_price: 10, amount: 30 }]} onChange={onChange} field={computedField} />);
      // Amount is display-only — there is no editable Amount cell.
      expect(screen.queryByLabelText('Amount')).toBeNull();
      // Editing quantity recomputes amount in the emitted row.
      fireEvent.change(screen.getAllByLabelText('Qty')[0], { target: { value: '4' } });
      expect(onChange).toHaveBeenCalledWith([{ product: 'Widget', quantity: 4, unit_price: 10, amount: 40 }]);
    });

    it('shows a dash for a computed cell whose inputs are blank', () => {
      render(<GridField value={[{ product: 'Widget', quantity: null, unit_price: null, amount: null }]} onChange={() => {}} field={computedField} />);
      // The computed amount cell reads "—" until its inputs exist.
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  describe('keyboard navigation', () => {
    it('Enter moves focus to the same column in the next row', () => {
      render(<GridField value={[{ description: 'A', amount: 1 }, { description: 'B', amount: 2 }]} onChange={() => {}} field={field} />);
      const row0 = screen.getAllByLabelText('Description')[0];
      row0.focus();
      fireEvent.keyDown(row0, { key: 'Enter' });
      expect(document.activeElement).toBe(screen.getAllByLabelText('Description')[1]);
    });
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

  it('row action buttons are always visible in grid mode (not hover-revealed)', () => {
    render(
      <GridField
        value={[{ description: 'A', amount: 1 }]}
        onChange={() => {}}
        field={field}
      />,
    );
    // Grid-mode rows previously gated these behind opacity-0/group-hover, so they
    // were invisible until hover and unreachable on touch — they must always show.
    expect(screen.getByLabelText('Remove row').className).not.toContain('opacity-0');
    expect(screen.getByTestId('line-items-duplicate-0').className).not.toContain('opacity-0');
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

  describe('lookupAutofillPatch (item typeahead auto-fill)', () => {
    const cols = [
      { field: 'product', type: 'lookup' as const, reference: 'product' },
      { field: 'description', type: 'text' as const },
      { field: 'quantity', type: 'number' as const },
      { field: 'unit_price', type: 'currency' as const },
      { field: 'amount', type: 'currency' as const, computed: true, expr: 'record.quantity * record.unit_price' },
    ];
    const product = { value: 'p1', label: 'Widget A', name: 'Widget A', description: 'Standard widget', unit_price: 29.99, sku: 'WIDGET-A' };

    it('sets the FK id and copies same-named sibling fields from the record', () => {
      const patch = lookupAutofillPatch(cols, cols[0], product);
      expect(patch).toEqual({ product: 'p1', description: 'Standard widget', unit_price: 29.99 });
      // quantity (not on the record) and computed amount are left to the row/compute.
      expect(patch).not.toHaveProperty('quantity');
      expect(patch).not.toHaveProperty('amount');
    });

    it('copies only the FK id when autofill is disabled', () => {
      const patch = lookupAutofillPatch(cols, { ...cols[0], autofill: false }, product);
      expect(patch).toEqual({ product: 'p1' });
    });
  });

  describe('P1 affordances (duplicate / validation)', () => {
    it('duplicates a row (id stripped) directly below the original', () => {
      const onChange = vi.fn();
      render(<GridField value={[{ id: 'r1', description: 'A', amount: 5 }]} onChange={onChange} field={field} />);
      fireEvent.click(screen.getByTestId('line-items-duplicate-0'));
      expect(onChange).toHaveBeenCalledWith([
        { id: 'r1', description: 'A', amount: 5 },
        { description: 'A', amount: 5 }, // copy without the id → persists as a new record
      ]);
    });

    it('flags a required, empty cell on a real row (not the ghost row)', () => {
      const reqField = { columns: [{ field: 'description', label: 'Description', type: 'text' as const, required: true }] } as any;
      render(<GridField value={[{ description: '' }]} onChange={() => {}} field={reqField} />);
      // The data row's required-empty cell is flagged...
      expect(screen.getByTestId('line-items-invalid-0-description')).toBeTruthy();
      // ...but the trailing ghost row (index 1) is not.
      expect(screen.queryByTestId('line-items-invalid-1-description')).toBeNull();
    });
  });

  it('sumColumn ignores blanks and NaN', () => {
    expect(sumColumn([{ amount: 1 }, { amount: 2 }, { amount: null }], 'amount')).toBe(3);
  });

  describe('parent-scoped conditional rules (B2 follow-up — "paid invoice → lock lines")', () => {
    const lockField = {
      columns: [
        { field: 'product', label: 'Product', type: 'text' as const },
        { field: 'qty', label: 'Qty', type: 'number' as const, readonlyWhen: "parent.status == 'paid'" },
        { field: 'unit_price', label: 'Unit Price', type: 'currency' as const, readonlyWhen: "parent.status == 'paid'" },
      ],
    } as any;

    it('leaves cells editable when the parent rule is FALSE', () => {
      render(
        <GridField
          value={[{ product: 'Widget', qty: 2, unit_price: 10 }]}
          onChange={() => {}}
          field={lockField}
          contextRecord={{ status: 'draft' }}
        />,
      );
      expect((screen.getAllByLabelText('Qty')[0] as HTMLInputElement).disabled).toBe(false);
      expect((screen.getAllByLabelText('Unit Price')[0] as HTMLInputElement).disabled).toBe(false);
    });

    it('locks cells whose readonlyWhen references the parent header', () => {
      render(
        <GridField
          value={[{ product: 'Widget', qty: 2, unit_price: 10 }]}
          onChange={() => {}}
          field={lockField}
          contextRecord={{ status: 'paid' }}
        />,
      );
      // The header is paid → quantity / unit price lock; product (no rule) stays editable.
      expect((screen.getAllByLabelText('Qty')[0] as HTMLInputElement).disabled).toBe(true);
      expect((screen.getAllByLabelText('Unit Price')[0] as HTMLInputElement).disabled).toBe(true);
      expect((screen.getAllByLabelText('Product')[0] as HTMLInputElement).disabled).toBe(false);
    });

    it('re-evaluates per row, mixing the parent header with row data', () => {
      const rowRule = {
        columns: [
          { field: 'qty', label: 'Qty', type: 'number' as const },
          // Locks only when the header is paid AND this row is already invoiced.
          { field: 'note', label: 'Note', type: 'text' as const, readonlyWhen: "parent.status == 'paid' && record.invoiced == true" },
        ],
      } as any;
      render(
        <GridField
          value={[{ qty: 1, note: 'a', invoiced: true }, { qty: 2, note: 'b', invoiced: false }]}
          onChange={() => {}}
          field={rowRule}
          contextRecord={{ status: 'paid' }}
        />,
      );
      const notes = screen.getAllByLabelText('Note') as HTMLInputElement[];
      expect(notes[0].disabled).toBe(true);  // invoiced row → locked
      expect(notes[1].disabled).toBe(false); // not-yet-invoiced row → editable
    });
  });
});
