/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `components/custom`'s ActionParamDialog — per-option `visibleWhen` reaches
 * this surface too (objectui#4758).
 *
 * The `select` branch rendered `param.options?.map(...)` straight into Radix
 * `SelectItem`s, bypassing `@object-ui/core`'s option evaluator entirely. On
 * this published dialog a per-option `visibleWhen` was not evaluated WRONG — it
 * was not evaluated at all, so every option was offered unconditionally while
 * the app-shell dialog (objectui#3765 / PR #4756) filtered the same metadata.
 * Triage ruled the governed side authoritative and this one rebinds to it
 * ("rebind, don't delete" — the component is a published export).
 *
 * ## What each case is for
 *
 * Two cases below are NON-VACUITY CONTROLS and pass on the unfixed code: they
 * prove the harness mounts the dialog and really opens the Radix listbox, so a
 * red result from the other cases is the defect rather than broken setup.
 * Marked inline.
 *
 * ## Reverse verification
 *
 * Restoring the bare `param.options?.map(...)` turns the four defect cases red
 * (an unfiltered list offers every option); the two controls stay green because
 * neither depends on filtering happening.
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ActionParamDef } from '@object-ui/core';
import { PredicateScopeProvider } from '@object-ui/react';
import { ActionParamDialog } from '../custom/action-param-dialog';

// Radix Select opens on pointer events happy-dom does not implement — same
// shim the in-form select tests use (`renderers/form/__tests__/
// option-value-round-trip.test.tsx`).
beforeAll(() => {
  class MockPointerEvent extends Event {
    button: number;
    ctrlKey: boolean;
    pointerType: string;
    constructor(type: string, props: any = {}) {
      super(type, props);
      this.button = props.button ?? 0;
      this.ctrlKey = props.ctrlKey ?? false;
      this.pointerType = props.pointerType ?? 'mouse';
    }
  }
  (window as any).PointerEvent = MockPointerEvent;
  (HTMLElement.prototype as any).hasPointerCapture = vi.fn();
  (HTMLElement.prototype as any).releasePointerCapture = vi.fn();
  (HTMLElement.prototype as any).scrollIntoView = vi.fn();
});

afterEach(cleanup);

/** The controlling param — a plain select with no predicates of its own. */
const tierParam: ActionParamDef = {
  name: 'tier',
  label: 'Tier',
  type: 'select',
  options: [
    { label: 'Silver tier', value: 'silver' },
    { label: 'Gold tier', value: 'gold' },
  ],
};

/** The dependent param: its second option is gated on the SIBLING param. */
const planParam: ActionParamDef = {
  name: 'plan',
  label: 'Plan',
  type: 'select',
  options: [
    { label: 'Basic plan', value: 'basic' },
    { label: 'Premium plan', value: 'premium', visibleWhen: "record.tier == 'gold'" },
  ],
};

function dialog(params: ActionParamDef[], onSubmit = vi.fn()) {
  return (
    <ActionParamDialog params={params} open onSubmit={onSubmit} onCancel={vi.fn()} />
  );
}

/** Open a param's Radix select by its host-owned control id. */
function openSelect(name: string) {
  const trigger = document.getElementById(name);
  expect(trigger).toBeTruthy();
  fireEvent.pointerDown(trigger!, { button: 0 });
}

/** The option labels a user can actually see in the open listbox. */
function offeredLabels(): string[] {
  return screen.getAllByRole('option').map((o) => (o.textContent ?? '').trim());
}

/** Pick an option by its visible label. */
async function pick(label: string) {
  const option = await screen.findByRole('option', { name: label });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole('option', { name: label })).toBeNull());
}

describe('custom ActionParamDialog — per-option visibleWhen (objectui#4758)', () => {
  it('CONTROL: mounts the dialog and really opens the select', async () => {
    render(dialog([planParam]));

    // The label a user reads, from the real render tree.
    expect(screen.getByText('Plan')).toBeInTheDocument();

    openSelect('plan');
    // If this resolves, the listbox opened — the precondition every case below
    // depends on. It passes with or without the fix.
    expect(await screen.findByRole('option', { name: 'Basic plan' })).toBeInTheDocument();
  });

  it('does not offer an option whose visibleWhen is FALSE against the dialog values', async () => {
    render(dialog([tierParam, planParam]));

    openSelect('plan');
    await screen.findByRole('option', { name: 'Basic plan' });

    // `tier` is still unset, so `record.tier == 'gold'` is false and the gold-
    // only option must not be in the list the user sees.
    expect(offeredLabels()).toEqual(['Basic plan']);
    expect(screen.queryByRole('option', { name: 'Premium plan' })).toBeNull();
  });

  it("resolves the predicate against the DIALOG's own in-progress values", async () => {
    render(dialog([tierParam, planParam]));

    openSelect('tier');
    await pick('Gold tier');

    openSelect('plan');
    await screen.findByRole('option', { name: 'Basic plan' });
    // The record IS this dialog's values (the ruled Option B semantics): once
    // the sibling param says gold, the gated option is offered. A fix that
    // resolved against a constant `{}` would leave it hidden here.
    expect(offeredLabels()).toEqual(['Basic plan', 'Premium plan']);
  });

  it('honours role/context gating supplied by the predicate scope', async () => {
    const roleParam: ActionParamDef = {
      name: 'grant',
      label: 'Grant',
      type: 'select',
      options: [
        { label: 'Read only', value: 'read' },
        { label: 'Admin only', value: 'admin', visibleWhen: "'admin' in current_user.positions" },
      ],
    };

    render(
      <PredicateScopeProvider scope={{ current_user: { positions: ['sales'] } }}>
        {dialog([roleParam])}
      </PredicateScopeProvider>,
    );

    openSelect('grant');
    await screen.findByRole('option', { name: 'Read only' });
    expect(offeredLabels()).toEqual(['Read only']);

    cleanup();

    render(
      <PredicateScopeProvider scope={{ current_user: { positions: ['admin'] } }}>
        {dialog([roleParam])}
      </PredicateScopeProvider>,
    );

    openSelect('grant');
    await screen.findByRole('option', { name: 'Read only' });
    // CONTROL half: an admin still sees both — the filter narrows, it does not
    // blank the list. Green with or without the fix.
    expect(offeredLabels()).toEqual(['Read only', 'Admin only']);
  });

  it('fails OPEN: a broken predicate keeps its option offered', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const brokenParam: ActionParamDef = {
        name: 'broken',
        label: 'Broken',
        type: 'select',
        options: [
          { label: 'Kept', value: 'kept' },
          { label: 'Also kept', value: 'also', visibleWhen: 'record.tier ===' },
        ],
      };

      render(dialog([brokenParam]));
      openSelect('broken');
      await screen.findByRole('option', { name: 'Kept' });
      expect(offeredLabels()).toEqual(['Kept', 'Also kept']);
    } finally {
      warn.mockRestore();
    }
  });

  it('drops a selection the predicate stopped offering, instead of submitting it unseen', async () => {
    const onSubmit = vi.fn();
    render(dialog([tierParam, planParam], onSubmit));

    openSelect('tier');
    await pick('Gold tier');
    openSelect('plan');
    await pick('Premium plan');

    // What the user sees right now: the trigger reads back their choice.
    await waitFor(() =>
      expect(document.getElementById('plan')!.textContent).toContain('Premium plan'),
    );

    // Now the controlling param moves away, so the gold-only option is no
    // longer offered.
    openSelect('tier');
    await pick('Silver tier');

    // The trigger must not keep displaying an option the list no longer holds,
    // and the submit must not carry it.
    await waitFor(() =>
      expect(document.getElementById('plan')!.textContent).not.toContain('Premium plan'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].plan).not.toBe('premium');
    expect(onSubmit.mock.calls[0][0].tier).toBe('silver');
  });

  it('leaves an option list that declares no predicate completely untouched', async () => {
    const onSubmit = vi.fn();
    const plainParam: ActionParamDef = {
      name: 'plain',
      label: 'Plain',
      type: 'select',
      // A default that matches no option — nothing here may clear it, because
      // no option on this param declares a predicate.
      defaultValue: 'orphaned',
      options: [
        { label: 'One', value: 'one' },
        { label: 'Two', value: 'two' },
      ],
    };

    render(dialog([plainParam], onSubmit));
    openSelect('plain');
    await screen.findByRole('option', { name: 'One' });
    expect(offeredLabels()).toEqual(['One', 'Two']);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].plain).toBe('orphaned');
  });
});
