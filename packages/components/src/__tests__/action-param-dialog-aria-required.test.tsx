/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ActionParamDialog (components/custom) — required must reach each CONTROL as
 * a state, not sit in the label as a bare `*` (objectui#3299; same shape as
 * #3290/#3298).
 *
 * Pre-fix, the five typed branches (textarea / number / select / date / text)
 * each drew `<span>*</span>` inside `<Label htmlFor>` with no `aria-hidden`
 * and put NO required state on the control: a screen reader heard the field as
 * "Reason asterisk" — worse than the old form.tsx, which at least had
 * `aria-label="required"`.
 *
 * Converged shape (EmbeddableForm.tsx reference): the control carries
 * `aria-required={required || undefined}`, the asterisk is `aria-hidden`.
 * Deliberately NOT native `required` — this dialog runs its own
 * "`<label>` is required" validation on submit; native required would arm the
 * browser's constraint-validation bubble beside it (#3290 ruling).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ActionParamDef } from '@object-ui/core';
import { ActionParamDialog } from '../custom/action-param-dialog';

afterEach(cleanup);

function openDialog(params: ActionParamDef[]) {
  return render(
    <ActionParamDialog
      params={params}
      open
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

const def = (over: Partial<ActionParamDef>): ActionParamDef =>
  ({ name: 'p1', label: 'Param One', type: 'text', ...over } as ActionParamDef);

/** The dialog gives each input `id={param.name}` — the stable locator. */
const control = (name: string) => {
  const el = document.getElementById(name);
  expect(el).not.toBeNull();
  return el as HTMLElement;
};

describe('custom ActionParamDialog — `aria-required` reaches the control (objectui#3299)', () => {
  it('sets aria-required="true" on the text / textarea / number / date controls', () => {
    openDialog([
      def({ name: 'title', label: 'Title', type: 'text', required: true }),
      def({ name: 'reason', label: 'Reason', type: 'textarea', required: true }),
      def({ name: 'count', label: 'Count', type: 'number', required: true }),
      def({ name: 'due', label: 'Due', type: 'date', required: true }),
    ]);

    for (const name of ['title', 'reason', 'count', 'due']) {
      expect(control(name)).toHaveAttribute('aria-required', 'true');
    }
  });

  it('sets aria-required="true" on the select trigger (the focusable combobox)', () => {
    openDialog([
      def({
        name: 'env',
        label: 'Environment',
        type: 'select',
        required: true,
        options: [{ label: 'Production', value: 'prod' }],
      }),
    ]);

    // The Radix root renders no element of its own; the trigger IS the
    // control, so the state must land there.
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-required', 'true');
  });

  it('omits the attribute entirely on optional params, rather than writing "false"', () => {
    openDialog([
      def({ name: 'notes', label: 'Notes', type: 'text' }),
      def({ name: 'detail', label: 'Detail', type: 'textarea' }),
    ]);

    expect(control('notes')).not.toHaveAttribute('aria-required');
    expect(control('detail')).not.toHaveAttribute('aria-required');
  });

  it('keeps the asterisk OUT of the accessible name — the state channel announces it once', () => {
    // Pre-fix the bare `*` sat inside `<Label htmlFor>` with no `aria-hidden`,
    // so the control's accessible name was "Title *" — read as
    // "Title asterisk". Asserted on the COMPUTED name, which is the only place
    // that failure is visible.
    openDialog([def({ name: 'title', label: 'Title', type: 'text', required: true })]);

    const ctl = control('title');
    expect(ctl).toHaveAccessibleName('Title');
    expect(ctl).toHaveAttribute('aria-required', 'true');
  });

  it('still renders the asterisk for sighted users, hidden from the a11y tree', () => {
    openDialog([def({ name: 'title', label: 'Title', type: 'text', required: true })]);

    const label = document.querySelector('label[for="title"]');
    expect(label).not.toBeNull();
    const marker = label!.querySelector('span');
    expect(marker).not.toBeNull();
    expect(marker).toHaveTextContent('*');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
  });

  it('never sets the native `required` attribute on any branch', () => {
    // Regression fence (#3290): native required arms the browser's own
    // validation bubble beside this dialog's submit-time messages. NOT
    // `toBeRequired()` — jest-dom counts `aria-required="true"` as required,
    // so that matcher cannot tell the two channels apart.
    openDialog([
      def({ name: 'title', label: 'Title', type: 'text', required: true }),
      def({ name: 'reason', label: 'Reason', type: 'textarea', required: true }),
    ]);

    const title = control('title') as HTMLInputElement;
    expect(title).not.toHaveAttribute('required');
    expect(title.required).toBe(false);

    const reason = control('reason') as HTMLTextAreaElement;
    expect(reason).not.toHaveAttribute('required');
    expect(reason.required).toBe(false);
  });
});
