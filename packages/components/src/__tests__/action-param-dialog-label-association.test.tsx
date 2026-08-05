/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ActionParamDialog (components/custom) — the `select` branch's `htmlFor` must
 * point at a control that actually exists (objectui#3341).
 *
 * Every branch renders `<Label htmlFor={param.name}>`, and textarea / number /
 * date / text all set the matching `id={param.name}` on their `Input` /
 * `Textarea`. The `select` branch did not: its control is a Radix
 * `SelectTrigger`, which carried no `id`, so the label referenced a
 * non-existent target and its text never reached the combobox — the one branch
 * where the label was decorative.
 *
 * Measured pre-fix accessible name in this harness: the EMPTY string.
 * `dom-accessibility-api` implements no `placeholder` fallback, so the
 * observable failure is an unnamed combobox rather than one named "Select...".
 * Either way the name was not the label, which is what these tests pin.
 *
 * `SelectTrigger` renders a `<button role="combobox">`, and `button` is a
 * labelable element, so a plain `htmlFor`/`id` pair is the correct association
 * here — no `aria-labelledby` needed (Radix sets none on the trigger).
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

const selectParam = (over: Partial<ActionParamDef> = {}): ActionParamDef =>
  def({
    name: 'env',
    label: 'Environment',
    type: 'select',
    options: [
      { label: 'Production', value: 'prod' },
      { label: 'Staging', value: 'stage' },
    ],
    ...over,
  });

describe('custom ActionParamDialog — select branch label→control association (objectui#3341)', () => {
  it('gives the SelectTrigger the id its Label already pointed at', () => {
    openDialog([selectParam()]);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('id', 'env');

    // The pre-fix state in one assertion: the label's target did not resolve.
    const label = document.querySelector('label[for="env"]');
    expect(label).not.toBeNull();
    expect(document.getElementById('env')).toBe(trigger);
  });

  it('resolves the label to the combobox, so getByLabelText finds it', () => {
    openDialog([selectParam()]);

    // Optional param → the label's textContent is exactly "Environment".
    // (RTL's label-text query reads raw textContent and does NOT honour
    // `aria-hidden`, so a required param's label would read "Environment*";
    // the required case is asserted on the accessible name below, where the
    // `*` is correctly excluded.)
    expect(screen.getByLabelText('Environment')).toBe(screen.getByRole('combobox'));
  });

  it('names the combobox from the LABEL, even with a placeholder present', () => {
    openDialog([selectParam({ placeholder: 'Pick an environment' })]);

    // Pre-fix this computed to '' because the label association did not
    // resolve (see the file header).
    expect(screen.getByRole('combobox')).toHaveAccessibleName('Environment');
  });

  it('keeps the required `*` out of the combobox accessible name', () => {
    openDialog([selectParam({ required: true })]);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAccessibleName('Environment');
    // The #3299 state channel is untouched by this change.
    expect(trigger).toHaveAttribute('aria-required', 'true');
  });

  it('leaves the other branches label-associated exactly as before', () => {
    // Fence: the select fix must not regress the branches that were already
    // correct — all five typed branches now name themselves from their label.
    openDialog([
      def({ name: 'title', label: 'Title', type: 'text' }),
      def({ name: 'reason', label: 'Reason', type: 'textarea' }),
      def({ name: 'count', label: 'Count', type: 'number' }),
      def({ name: 'due', label: 'Due', type: 'date' }),
      selectParam(),
    ]);

    for (const [name, label] of [
      ['title', 'Title'],
      ['reason', 'Reason'],
      ['count', 'Count'],
      ['due', 'Due'],
      ['env', 'Environment'],
    ] as const) {
      const control = document.getElementById(name);
      expect(control, `no control rendered with id="${name}"`).not.toBeNull();
      expect(control).toHaveAccessibleName(label);
      expect(screen.getByLabelText(label)).toBe(control);
    }
  });
});
