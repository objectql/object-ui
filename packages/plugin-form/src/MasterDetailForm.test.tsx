import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { registerAllFields } from '@object-ui/fields';
import { MasterDetailForm } from './MasterDetailForm';

// Capture toast calls so we can assert the form is never a silent no-op.
const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock('@object-ui/components', async (orig) => {
  const actual = await (orig as any)();
  return { ...actual, toast: { success: toastSuccess, error: toastError } };
});

registerAllFields();

// Parent object with a single non-required text field so a jsdom submit can
// actually validate + succeed (no Radix selects in the test surface).
const parentSchema = { name: 'po', fields: { ref: { type: 'text', label: 'Ref' } } };

function makeDataSource(overrides: any = {}) {
  return {
    getObjectSchema: vi.fn().mockResolvedValue(parentSchema),
    find: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulk: vi.fn(),
    ...overrides,
  } as any;
}

describe('MasterDetailForm — submit feedback (never silent)', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('atomic path: shows a success toast + clears the form on create', async () => {
    const batchTransaction = vi.fn().mockResolvedValue({ results: [{ id: 'po1' }] });
    const onSuccess = vi.fn();
    const ds = makeDataSource({ batchTransaction });

    const { container } = render(
      <MasterDetailForm
        schema={{
          objectName: 'po',
          mode: 'create',
          fields: ['ref'],
          onSuccess,
          details: [
            { childObject: 'po_line', relationshipField: 'po', columns: [{ key: 'qty', label: 'Qty', type: 'number' } as any] },
          ],
        } as any}
        dataSource={ds}
      />,
    );

    const input = await waitFor(() => {
      const el = container.querySelector('input[name="ref"]') as HTMLInputElement | null;
      if (!el) throw new Error('parent form not ready');
      return el;
    });
    fireEvent.change(input, { target: { value: 'PO-1' } });

    // Drive the bottom action bar's Create button.
    const createBtn = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createBtn);

    await waitFor(() => expect(batchTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled()); // <- never silent
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Parent form remounted (cleared) for the next entry.
    await waitFor(() => {
      const el = container.querySelector('input[name="ref"]') as HTMLInputElement | null;
      expect(el && el.value).toBeFalsy();
    });
  });

  it('shows an error toast when the atomic write fails (rollback)', async () => {
    const batchTransaction = vi.fn().mockRejectedValue(new Error('BATCH_ERROR: rolled back'));
    const ds = makeDataSource({ batchTransaction });

    const { container } = render(
      <MasterDetailForm
        schema={{
          objectName: 'po',
          mode: 'create',
          fields: ['ref'],
          details: [
            { childObject: 'po_line', relationshipField: 'po', columns: [{ key: 'qty', label: 'Qty', type: 'number' } as any] },
          ],
        } as any}
        dataSource={ds}
      />,
    );

    const input = await waitFor(() => {
      const el = container.querySelector('input[name="ref"]') as HTMLInputElement | null;
      if (!el) throw new Error('parent form not ready');
      return el;
    });
    fireEvent.change(input, { target: { value: 'PO-2' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(batchTransaction).toHaveBeenCalled());
    await waitFor(() => expect(toastError).toHaveBeenCalled()); // <- failure is surfaced
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe('MasterDetailForm — parent-scoped line rules ("paid invoice → lock lines", #1581)', () => {
  // Parent header carries a `status` text field (a real <select> can't be driven
  // by synthetic events in jsdom — that path is covered by the live e2e spec).
  const invSchema = { name: 'inv', fields: { status: { type: 'text', label: 'Status' } } };

  function lockDataSource(overrides: any = {}) {
    return {
      getObjectSchema: vi.fn().mockResolvedValue(invSchema),
      find: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      bulk: vi.fn(),
      ...overrides,
    } as any;
  }

  const schema = {
    objectName: 'inv',
    mode: 'create',
    fields: ['status'],
    details: [
      {
        childObject: 'inv_line',
        relationshipField: 'inv',
        columns: [
          { field: 'product', label: 'Product', type: 'text' },
          { field: 'qty', label: 'Qty', type: 'number', readonlyWhen: "parent.status == 'paid'" },
        ],
      },
    ],
  } as any;

  it('locks a line cell when the header makes its readonlyWhen TRUE, and unlocks on change', async () => {
    const { container } = render(<MasterDetailForm schema={schema} dataSource={lockDataSource()} />);

    const status = await waitFor(() => {
      const el = container.querySelector('input[name="status"]') as HTMLInputElement | null;
      if (!el) throw new Error('header not ready');
      return el;
    });
    const qty = () => screen.getAllByLabelText('Qty')[0] as HTMLInputElement;

    // Header not paid → the Qty cell is editable.
    await waitFor(() => expect(qty().disabled).toBe(false));

    // Header becomes paid → the Qty cell locks (parent.status == 'paid').
    fireEvent.change(status, { target: { value: 'paid' } });
    await waitFor(() => expect(qty().disabled).toBe(true));
    // A column without a rule stays editable regardless of the header.
    expect((screen.getAllByLabelText('Product')[0] as HTMLInputElement).disabled).toBe(false);

    // Header moves off paid → the cell unlocks again.
    fireEvent.change(status, { target: { value: 'draft' } });
    await waitFor(() => expect(qty().disabled).toBe(false));
  });

  it('does not reset the header form when a line locks (isolated re-render)', async () => {
    const { container } = render(<MasterDetailForm schema={schema} dataSource={lockDataSource()} />);

    const status = await waitFor(() => {
      const el = container.querySelector('input[name="status"]') as HTMLInputElement | null;
      if (!el) throw new Error('header not ready');
      return el;
    });

    fireEvent.change(status, { target: { value: 'paid' } });
    // The scrape-driven lock must NOT wipe the value the user just typed.
    await waitFor(() => expect((screen.getAllByLabelText('Qty')[0] as HTMLInputElement).disabled).toBe(true));
    expect((container.querySelector('input[name="status"]') as HTMLInputElement).value).toBe('paid');
  });
});

describe('MasterDetailForm — showSubmit gate (Studio screen preview)', () => {
  const base = {
    objectName: 'po',
    mode: 'create',
    fields: ['ref'],
    details: [
      { childObject: 'po_line', relationshipField: 'po', columns: [{ key: 'qty', label: 'Qty', type: 'number' } as any] },
    ],
  } as any;

  it('renders its own Save/Create action bar by default', async () => {
    render(<MasterDetailForm schema={base} dataSource={makeDataSource()} />);
    await waitFor(() => expect(screen.getByTestId('md-form-submit')).toBeInTheDocument());
  });

  it('hides the action bar when showSubmit is false (non-persisting preview)', async () => {
    const { container } = render(
      <MasterDetailForm schema={{ ...base, showSubmit: false }} dataSource={makeDataSource()} />,
    );
    // The form/grid still renders — it just can never be submitted.
    await waitFor(() => {
      if (!container.querySelector('input[name="ref"]')) throw new Error('header not ready');
    });
    expect(screen.queryByTestId('md-form-submit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create|save/i })).not.toBeInTheDocument();
  });
});
