/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Regression coverage: a multi-step `object-form` (`formType: 'wizard'`) must
 * submit the MERGED payload from every step. Two bugs previously made the
 * create POST carry an empty/partial body (and the server rejected required
 * fields):
 *   1. the footer Next/Create buttons bypassed the inner form and submitted the
 *      wizard's own (never-collected) `formData`;
 *   2. the create-mode seeding effect reset `formData` to `{}` on re-render.
 * The buttons now submit the inner form natively (`type="submit"` + `form={id}`)
 * and the create seed is idempotent.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { WizardForm } from './WizardForm';
import { registerAllFields } from '@object-ui/fields';

registerAllFields();

const objectSchema = {
  name: 'wiz_obj',
  fields: {
    name: { type: 'text', label: 'Name' },
    note: { type: 'text', label: 'Note' },
  },
};

const makeDS = () => ({
  getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
  create: vi.fn(async (_o: string, data: any) => ({ id: 'r1', ...data })),
  update: vi.fn(),
  findOne: vi.fn(),
});

const schema = {
  type: 'object-form',
  formType: 'wizard',
  objectName: 'wiz_obj',
  mode: 'create',
  sections: [
    { label: 'Step 1', fields: ['name'] },
    { label: 'Step 2', fields: ['note'] },
  ],
};

describe('WizardForm — multi-step create collects every step', () => {
  it('submits the merged payload (both steps), not an empty/last-only body', async () => {
    const ds = makeDS();
    const { container } = render(<WizardForm schema={schema as any} dataSource={ds as any} />);

    const nameInput = await waitFor(() => {
      const el = container.querySelector('input[name="name"]') as HTMLInputElement | null;
      if (!el) throw new Error('step-1 name input not rendered');
      return el;
    });
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement); // advance to step 2

    const noteInput = await waitFor(() => {
      const el = container.querySelector('input[name="note"]') as HTMLInputElement | null;
      if (!el) throw new Error('step-2 note input not rendered');
      return el;
    });
    fireEvent.change(noteInput, { target: { value: 'hello' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement); // final create

    await waitFor(() => expect(ds.create).toHaveBeenCalledTimes(1));
    const [obj, payload] = ds.create.mock.calls[0];
    expect(obj).toBe('wiz_obj');
    // The regression was: payload === {} or { note } only. Must carry BOTH steps.
    expect(payload).toEqual(expect.objectContaining({ name: 'Alice', note: 'hello' }));
  });

  it('wires the footer Next/Create buttons to the step form (cannot bypass it)', async () => {
    const ds = makeDS();
    const { container } = render(<WizardForm schema={schema as any} dataSource={ds as any} />);
    await waitFor(() => {
      if (!container.querySelector('input[name="name"]')) throw new Error('not ready');
    });
    const form = container.querySelector('form') as HTMLFormElement;
    const formId = form.getAttribute('id');
    expect(formId).toBeTruthy();
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn.getAttribute('type')).toBe('submit');
    expect(nextBtn.getAttribute('form')).toBe(formId);
  });
});
