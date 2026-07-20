/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * filterVisibleParams — action params gated by a `visible` CEL predicate
 * (evaluated against the features/user/app/data scope). Fixes the create-user
 * form offering a `phoneNumber` field the default backend rejects: the param is
 * `visible: 'features.phoneNumber == true'`, so it's hidden unless the opt-in
 * phoneNumber auth plugin is loaded.
 *
 * ActionParamDialog render tests — the dialog routes every param through the
 * shared form field-widget renderer (ADR-0059), so these pin the behavior
 * contract across the swap: each type renders its real widget (lazy, behind
 * Suspense), values round-trip through `resolve`, and `required` validation
 * still blocks submit.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionParamDef } from '@object-ui/core';
import { ActionParamDialog, filterVisibleParams, serializeParamValues } from './ActionParamDialog';

const p = (name: string, visible?: string): ActionParamDef => ({
  name,
  label: name,
  type: 'text',
  ...(visible ? { visible } : {}),
});

describe('filterVisibleParams', () => {
  it('keeps params that have no visible predicate', () => {
    const params = [p('email'), p('name')];
    expect(filterVisibleParams(params, {}).map((x) => x.name)).toEqual(['email', 'name']);
  });

  it('hides the phoneNumber param when features.phoneNumber is false', () => {
    const params = [p('email'), p('phoneNumber', 'features.phoneNumber == true'), p('name')];
    const out = filterVisibleParams(params, { features: { phoneNumber: false } });
    expect(out.map((x) => x.name)).toEqual(['email', 'name']);
  });

  it('shows the phoneNumber param when features.phoneNumber is true', () => {
    const params = [p('email'), p('phoneNumber', 'features.phoneNumber == true'), p('name')];
    const out = filterVisibleParams(params, { features: { phoneNumber: true } });
    expect(out.map((x) => x.name)).toEqual(['email', 'phoneNumber', 'name']);
  });

  it('hides a feature-gated param when the flag is absent (conservative)', () => {
    const params = [p('phoneNumber', 'features.phoneNumber == true')];
    expect(filterVisibleParams(params, { features: {} })).toEqual([]);
  });

  it('defaults to visible when the predicate is malformed (fail-open)', () => {
    const params = [p('x', 'this is ((( not valid')];
    expect(filterVisibleParams(params, {}).map((x) => x.name)).toEqual(['x']);
  });

  it('handles the normalized {dialect, source} form the spec serializes to', () => {
    // The framework's ExpressionInputSchema normalizes the authored string to
    // `{ dialect: 'cel', source: '...' }`, so the served param carries the object
    // form — the evaluator unwraps `.source`, so gating still works.
    const params: ActionParamDef[] = [
      { name: 'phoneNumber', label: 'Phone', type: 'text', visible: { dialect: 'cel', source: 'features.phoneNumber == true' } as any },
    ];
    expect(filterVisibleParams(params, { features: { phoneNumber: false } })).toEqual([]);
    expect(filterVisibleParams(params, { features: { phoneNumber: true } }).map((x) => x.name)).toEqual(['phoneNumber']);
  });
});

/** Mount the dialog open with the given params; returns the resolve spy. */
function openDialog(params: ActionParamDef[]) {
  const resolve = vi.fn();
  render(
    <ActionParamDialog
      state={{ open: true, params, resolve }}
      onOpenChange={() => {}}
    />,
  );
  return resolve;
}

const confirm = () => fireEvent.click(screen.getByText('actionDialog.confirm'));

const def = (over: Partial<ActionParamDef>): ActionParamDef => ({
  name: 'p1',
  label: 'Param One',
  type: 'text',
  ...over,
});

describe('ActionParamDialog — shared field-widget rendering (ADR-0059)', () => {
  it('renders a text param and round-trips the typed value on confirm', async () => {
    const resolve = openDialog([def({ name: 'note', type: 'text' })]);
    const input = await screen.findByLabelText('Param One');
    fireEvent.change(input, { target: { value: 'hello' } });
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ note: 'hello' }));
  });

  it('renders a textarea param through the shared TextAreaField', async () => {
    const resolve = openDialog([def({ name: 'reason', type: 'textarea' })]);
    const box = await screen.findByLabelText('Param One');
    expect(box.tagName).toBe('TEXTAREA');
    fireEvent.change(box, { target: { value: 'because' } });
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ reason: 'because' }));
  });

  it('renders a number param and emits a numeric value (not a string)', async () => {
    const resolve = openDialog([def({ name: 'count', type: 'number' })]);
    const input = await screen.findByLabelText('Param One');
    expect(input.getAttribute('type')).toBe('number');
    fireEvent.change(input, { target: { value: '42' } });
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ count: 42 }));
  });

  it('renders a boolean param as a checkbox row that toggles to true', async () => {
    const resolve = openDialog([def({ name: 'force', type: 'boolean' })]);
    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ force: true }));
  });

  it('renders a select param through the shared SelectField (combobox trigger)', async () => {
    openDialog([
      def({
        name: 'env',
        type: 'select',
        options: [
          { label: 'Production', value: 'prod' },
          { label: 'Staging', value: 'stage' },
        ],
      }),
    ]);
    expect(await screen.findByRole('combobox')).toBeTruthy();
  });

  it('renders a date param through the shared DateField (native date input)', async () => {
    const resolve = openDialog([def({ name: 'due', type: 'date' })]);
    const input = await screen.findByLabelText('Param One');
    expect(input.getAttribute('type')).toBe('date');
    fireEvent.change(input, { target: { value: '2026-07-19' } });
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ due: '2026-07-19' }));
  });

  it('renders a file param as a real upload control, not a text box (#2698)', async () => {
    openDialog([def({ name: 'attachments', type: 'file', multiple: true })]);
    await waitFor(() => {
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
      expect((fileInput as HTMLInputElement).multiple).toBe(true);
    });
  });

  it('renders a color param through the shared ColorField (color input)', async () => {
    openDialog([def({ name: 'tint', type: 'color' })]);
    await waitFor(() => {
      expect(document.querySelector('input[type="color"]')).toBeTruthy();
    });
  });

  it('required + empty blocks submit and shows the error message', async () => {
    const resolve = openDialog([def({ name: 'note', type: 'text', required: true })]);
    await screen.findByLabelText(/Param One/);
    confirm();
    expect(await screen.findByText('actionDialog.requiredError')).toBeTruthy();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('an unknown param type falls back to a plain text input', async () => {
    const resolve = openDialog([def({ name: 'x', type: 'no-such-type' })]);
    const input = await screen.findByLabelText('Param One');
    expect(input.getAttribute('type')).toBe('text');
    fireEvent.change(input, { target: { value: 'v' } });
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ x: 'v' }));
  });

  it('seeds defaultValue and returns it untouched on confirm', async () => {
    const resolve = openDialog([def({ name: 'note', type: 'text', defaultValue: 'seed' })]);
    const input = await screen.findByLabelText('Param One');
    expect((input as HTMLInputElement).value).toBe('seed');
    confirm();
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ note: 'seed' }));
  });
});

describe('serializeParamValues', () => {
  const fileParam = (name: string, multiple = false): ActionParamDef =>
    ({ name, label: name, type: 'file', ...(multiple ? { multiple: true } : {}) } as ActionParamDef);

  it('is a no-op when there are no upload params', () => {
    const values = { comment: 'hi', to: 'u1' };
    expect(serializeParamValues([p('comment'), p('to')], values)).toBe(values);
  });

  it('maps a single file param object to its file_id', () => {
    const out = serializeParamValues([fileParam('attachments')], {
      comment: 'ok',
      attachments: { file_id: 'f_123', name: 'x.pdf', url: 'https://…' },
    });
    expect(out).toEqual({ comment: 'ok', attachments: 'f_123' });
  });

  it('maps a multiple file param array to file_id[]', () => {
    const out = serializeParamValues([fileParam('attachments', true)], {
      attachments: [
        { file_id: 'f_1', name: 'a' },
        { file_id: 'f_2', name: 'b' },
      ],
    });
    expect(out).toEqual({ attachments: ['f_1', 'f_2'] });
  });

  it('passes a bare string id through unchanged', () => {
    expect(serializeParamValues([fileParam('attachments')], { attachments: 'f_9' }))
      .toEqual({ attachments: 'f_9' });
  });

  it('leaves an absent / null upload value alone', () => {
    expect(serializeParamValues([fileParam('attachments', true)], { comment: 'c' }))
      .toEqual({ comment: 'c' });
    expect(serializeParamValues([fileParam('attachments')], { attachments: null }))
      .toEqual({ attachments: null });
  });

  it('does not touch non-upload params', () => {
    const out = serializeParamValues([fileParam('attachments'), p('comment')], {
      attachments: { file_id: 'f_1' },
      comment: 'keep me',
    });
    expect(out).toEqual({ attachments: 'f_1', comment: 'keep me' });
  });
});
