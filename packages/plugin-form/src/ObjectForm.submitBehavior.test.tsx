/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Declarative `submitBehavior` handling for metadata-only (non-wizard) forms —
 * mirrors WizardForm.successBehavior.test.tsx for the flat ObjectForm path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, toast: { ...actual.toast, success: toastSuccess, error: vi.fn() } };
});

import { ObjectForm } from './ObjectForm';
import { registerAllFields } from '@object-ui/fields';

registerAllFields();

const objectSchema = {
  name: 'o',
  fields: { name: { type: 'text', label: 'Name' } },
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

describe('ObjectForm — submitBehavior', () => {
  beforeEach(() => toastSuccess.mockClear());

  it('redirect: same-origin-guarded navigate, no toast', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const ds = makeDS();
    const { container } = render(
      <ObjectForm
        schema={{
          type: 'object-form', objectName: 'o', mode: 'create',
          submitBehavior: { kind: 'redirect', url: '/apps/x/done' },
        } as any}
        dataSource={ds as any}
      />,
    );
    fireEvent.change(await waitInput(container, 'name'), { target: { value: 'Alpha' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/apps/x/done'));
    expect(toastSuccess).not.toHaveBeenCalled();
    assign.mockRestore();
  });

  it('thank-you: toasts the custom message', async () => {
    const ds = makeDS();
    const { container } = render(
      <ObjectForm
        schema={{
          type: 'object-form', objectName: 'o', mode: 'create',
          submitBehavior: { kind: 'thank-you', message: 'All set!' },
        } as any}
        dataSource={ds as any}
      />,
    );
    fireEvent.change(await waitInput(container, 'name'), { target: { value: 'Alpha' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('All set!'));
  });

  it('thank-you: replaces the filled form with a confirmation panel — no way to resubmit', async () => {
    const ds = makeDS();
    const { container, getByText } = render(
      <ObjectForm
        schema={{
          type: 'object-form', objectName: 'o', mode: 'create',
          submitBehavior: { kind: 'thank-you', title: 'Created', message: 'All set!' },
        } as any}
        dataSource={ds as any}
      />,
    );
    fireEvent.change(await waitInput(container, 'name'), { target: { value: 'Alpha' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(ds.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByText('Created')).toBeTruthy());
    // The form (with its submit button) is gone — previously it stayed
    // mounted and fully filled, so a second click created a duplicate record.
    expect(container.querySelector('input[name="name"]')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(ds.create).toHaveBeenCalledTimes(1);
  });

  it('continue: resets the form for another entry', async () => {
    const ds = makeDS();
    const { container } = render(
      <ObjectForm
        schema={{
          type: 'object-form', objectName: 'o', mode: 'create',
          submitBehavior: { kind: 'continue' },
        } as any}
        dataSource={ds as any}
      />,
    );
    fireEvent.change(await waitInput(container, 'name'), { target: { value: 'Alpha' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(ds.create).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const el = container.querySelector('input[name="name"]') as HTMLInputElement | null;
      if (!el) throw new Error('form gone');
      expect(el.value).toBe('');
    });
  });
});
