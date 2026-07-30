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
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

/**
 * A step's input being in the DOM does NOT mean the step is ready to type into.
 * The inner step form is reused across steps (one react-hook-form instance) and
 * the wizard feeds it `defaultValues={formData}`; when that value changes the
 * form applies it with a `reset()` in a PASSIVE EFFECT — i.e. one commit after
 * the new step's inputs have already been painted. `waitFor` can resolve inside
 * that window, and a value typed there is lost: the pending reset replaces the
 * whole RHF record with the earlier steps' data, dropping the field just filled,
 * so the final create posts a body missing the last step. That is a test-harness
 * race, not the product regression this file guards, and it made CI flaky
 * (#2982). Drain the pending effects before typing so each step is settled.
 */
const settledStepInput = async (container: HTMLElement, name: string) => {
  const el = await waitFor(() => {
    const found = container.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
    if (!found) throw new Error(`step input "${name}" not rendered`);
    return found;
  });
  // Flush the step form's pending `defaultValues` reset so it cannot land
  // *after* the change below and clobber it.
  await act(async () => {});
  return el;
};

describe('WizardForm — multi-step create collects every step', () => {
  it('submits the merged payload (both steps), not an empty/last-only body', async () => {
    const ds = makeDS();
    const { container } = render(<WizardForm schema={schema as any} dataSource={ds as any} />);

    const nameInput = await settledStepInput(container, 'name');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement); // advance to step 2

    const noteInput = await settledStepInput(container, 'note');
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
