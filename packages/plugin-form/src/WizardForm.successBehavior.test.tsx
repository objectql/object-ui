/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Declarative post-success behaviors for metadata-only wizards:
 *   - navigateOnSuccess (interpolate {id}, same-origin, skip toast)
 *   - resetOnSuccess (back to a cleared step 1, toast)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, toast: { ...actual.toast, success: toastSuccess, error: vi.fn() } };
});

import { WizardForm } from './WizardForm';
import { registerAllFields } from '@object-ui/fields';

registerAllFields();

const objectSchema = {
  name: 'o',
  fields: { name: { type: 'text', label: 'Name' }, note: { type: 'text', label: 'Note' } },
};
const makeDS = () => ({
  getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
  create: vi.fn(async (_o: string, d: any) => ({ id: 'r1', ...d })),
  update: vi.fn(),
  findOne: vi.fn(),
});
const waitInput = (c: HTMLElement, name: string) =>
  waitFor(() => {
    const el = c.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
    if (!el) throw new Error(`${name} not ready`);
    return el;
  });

describe('WizardForm — navigateOnSuccess', () => {
  beforeEach(() => toastSuccess.mockClear());
  it('navigates to the saved record (interpolated) and skips the toast', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const ds = makeDS();
    const schema = {
      type: 'object-form', formType: 'wizard', objectName: 'o', mode: 'create',
      navigateOnSuccess: '/apps/x/o/record/{id}', sections: [{ label: 'A', fields: ['name'] }],
    };
    const { container } = render(<WizardForm schema={schema as any} dataSource={ds as any} />);
    fireEvent.change(await waitInput(container, 'name'), { target: { value: 'Alpha' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/apps/x/o/record/r1'));
    expect(toastSuccess).not.toHaveBeenCalled();
    assign.mockRestore();
  });
});

describe('WizardForm — resetOnSuccess', () => {
  beforeEach(() => toastSuccess.mockClear());
  it('returns to a cleared step 1 after create and toasts', async () => {
    const ds = makeDS();
    const schema = {
      type: 'object-form', formType: 'wizard', objectName: 'o', mode: 'create',
      resetOnSuccess: true,
      sections: [{ label: 'A', fields: ['name'] }, { label: 'B', fields: ['note'] }],
    };
    const { container } = render(<WizardForm schema={schema as any} dataSource={ds as any} />);
    fireEvent.change(await waitInput(container, 'name'), { target: { value: 'Alpha' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement); // → step 2
    fireEvent.change(await waitInput(container, 'note'), { target: { value: 'hi' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement); // → create
    await waitFor(() => expect(ds.create).toHaveBeenCalledTimes(1));
    // Reset: step 1 field is back and cleared.
    await waitFor(() => {
      const el = container.querySelector('input[name="name"]') as HTMLInputElement | null;
      if (!el) throw new Error('not back to step 1');
      expect(el.value).toBe('');
    });
    expect(toastSuccess).toHaveBeenCalled();
  });
});
