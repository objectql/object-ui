/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ActionParamDialog (app-shell) — required must reach the field WIDGET's
 * control as a state, not sit in the label as a bare `*` (objectui#3299; same
 * shape as #3290/#3298).
 *
 * This dialog routes params through the real `@object-ui/fields` widgets
 * (ADR-0059), so the state travels host → widget props → `toDomProps` (whose
 * whitelist forwards `aria-*` by prefix, objectui#3291) → the rendered
 * control. These tests drive that FULL delivery chain with real widgets — a
 * widget-side strip of `aria-*` would fail here, not just a host-side
 * omission.
 *
 * Deliberately NOT native `required` (#3290 ruling): the dialog runs its own
 * required validation (`requiredError` messages); native required would arm
 * the browser's constraint-validation bubble beside it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ActionParamDef } from '@object-ui/core';
import { ActionParamDialog } from './ActionParamDialog';

/** Mount the dialog open with the given params (mirrors ActionParamDialog.test.tsx). */
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

const def = (over: Partial<ActionParamDef>): ActionParamDef => ({
  name: 'p1',
  label: 'Param One',
  type: 'text',
  ...over,
});

describe('app-shell ActionParamDialog — `aria-required` reaches the widget control (objectui#3299)', () => {
  it('sets aria-required="true" on a required text param, delivered through the real widget', async () => {
    openDialog([def({ name: 'note', type: 'text', required: true })]);

    const input = await screen.findByLabelText(/Param One/);
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('omits the attribute entirely on an optional param, rather than writing "false"', async () => {
    openDialog([def({ name: 'note', type: 'text' })]);

    const input = await screen.findByLabelText(/Param One/);
    expect(input).not.toHaveAttribute('aria-required');
  });

  it('sets aria-required="true" on the boolean branch too (checkbox row)', async () => {
    // The boolean branch is a SEPARATE render path (inline checkbox row) —
    // fixing only the default branch would leave this one silent.
    openDialog([def({ name: 'force', type: 'boolean', required: true })]);

    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-required', 'true');
  });

  it('keeps the asterisk OUT of the accessible name — state announced once, not "asterisk"', async () => {
    // Pre-fix the bare `*` inside `<Label htmlFor>` folded into the control's
    // accessible name ("Param One asterisk"). Only the computed name shows
    // that regression, so that is what gets pinned.
    openDialog([def({ name: 'note', type: 'text', required: true })]);

    const input = await screen.findByLabelText(/Param One/);
    expect(input).toHaveAccessibleName('Param One');

    const label = document.querySelector('label[for="note"]');
    expect(label).not.toBeNull();
    const marker = label!.querySelector('span');
    expect(marker).not.toBeNull();
    expect(marker).toHaveTextContent('*');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
  });

  it('never sets the native `required` attribute (#3290: no double validation UI)', async () => {
    openDialog([def({ name: 'note', type: 'text', required: true })]);

    const input = (await screen.findByLabelText(/Param One/)) as HTMLInputElement;
    // NOT `toBeRequired()` — jest-dom counts `aria-required="true"` as
    // required, so it cannot distinguish the channel under test.
    await waitFor(() => expect(input).toHaveAttribute('aria-required', 'true'));
    expect(input).not.toHaveAttribute('required');
    expect(input.required).toBe(false);
  });
});
