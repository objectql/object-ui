/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * FieldContainer — the required STATE must reach the slotted control
 * (objectui#3299, the same "declared ≠ delivered" gap #3290/#3298 closed in
 * the form renderer).
 *
 * `FieldContainer` computed `required` and spent it on exactly one thing: the
 * label's CSS pseudo-element asterisk (`after:content-['*']`) — pure paint
 * that never enters the accessibility tree as a state. Meanwhile its Slot
 * injection already delivered `id` / `aria-describedby` / `aria-invalid` to
 * whatever control the caller slots in, so the container was ALREADY the
 * single a11y-wiring authority for its children — it just skipped this one
 * attribute. The fix rides the same Slot injection, so one line covers every
 * consumer of FieldContainer.
 *
 * Deliberately NOT the native `required` attribute (#3290 ruling): that would
 * arm the browser's constraint-validation bubble alongside the host's own
 * `error` slot — two validators, two UIs, one field.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FieldContainer } from '../custom/field';

afterEach(cleanup);

describe('FieldContainer — `aria-required` rides the Slot injection (objectui#3299)', () => {
  it('sets aria-required="true" on the slotted control when required', () => {
    render(
      <FieldContainer label="Title" required>
        <input data-testid="ctl" />
      </FieldContainer>,
    );

    expect(screen.getByTestId('ctl')).toHaveAttribute('aria-required', 'true');
  });

  it('omits the attribute entirely when optional, rather than writing "false"', () => {
    // `|| undefined`, matching the reference shape (EmbeddableForm.tsx /
    // PR #3298): absence, not `aria-required="false"`.
    render(
      <FieldContainer label="Title">
        <input data-testid="ctl" />
      </FieldContainer>,
    );

    expect(screen.getByTestId('ctl')).not.toHaveAttribute('aria-required');
  });

  it('never sets the native `required` attribute', () => {
    // Regression fence: the "obvious" alternative fix is exactly the change
    // that must not happen (#3290 — native required arms browser constraint
    // validation on top of the host's error slot). NOT `toBeRequired()`:
    // jest-dom counts `aria-required="true"` as required, so that matcher
    // cannot distinguish the two channels.
    render(
      <FieldContainer label="Title" required>
        <input data-testid="ctl" />
      </FieldContainer>,
    );

    const ctl = screen.getByTestId('ctl') as HTMLInputElement;
    expect(ctl).toHaveAttribute('aria-required', 'true');
    expect(ctl).not.toHaveAttribute('required');
    expect(ctl.required).toBe(false);
  });

  it('coexists with the pre-existing Slot injections (id, aria-invalid, aria-describedby)', () => {
    // The fix must extend the injection, not replace it — a regression that
    // swapped the prop set instead of adding to it would pass the tests above
    // and still break error announcement.
    render(
      <FieldContainer label="Title" required error="Required" htmlFor="my-field">
        <input data-testid="ctl" />
      </FieldContainer>,
    );

    const ctl = screen.getByTestId('ctl');
    expect(ctl).toHaveAttribute('id', 'my-field');
    expect(ctl).toHaveAttribute('aria-required', 'true');
    expect(ctl).toHaveAttribute('aria-invalid', 'true');
    expect(ctl).toHaveAttribute('aria-describedby', 'my-field-error');
  });

  it('keeps the label association intact so the name and the state stay separate channels', () => {
    render(
      <FieldContainer label="Title" required htmlFor="assoc-field">
        <input />
      </FieldContainer>,
    );

    // The asterisk is a CSS pseudo-element (`after:content-['*']`), so it can
    // never leak into the accessible name — the state channel is the ONLY
    // required signal, exactly the converged shape.
    const ctl = screen.getByLabelText('Title');
    expect(ctl).toHaveAccessibleName('Title');
    expect(ctl).toHaveAttribute('aria-required', 'true');
  });
});
