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
