/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * InlineCreateRelated — the create-tab inputs must announce required as a
 * STATE on the control, not as a bare `*` next to the label (objectui#3299;
 * same shape as #3290/#3298).
 *
 * Pre-fix, `field.required` drew `<span>*</span>` with no `aria-hidden` and
 * put nothing on the `<Input>` — the component's own `isCreateValid` gating
 * knew which fields were required, assistive tech did not.
 *
 * Deliberately NOT native `required` (#3290 ruling): this form validates via
 * `isCreateValid` disabling the Create button; native required would arm the
 * browser's constraint-validation bubble beside it.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InlineCreateRelated } from '../InlineCreateRelated';
import type { RelatedFieldDefinition } from '../InlineCreateRelated';

afterEach(cleanup);

const fields: RelatedFieldDefinition[] = [
  { name: 'name', label: 'Name', type: 'string', required: true },
  { name: 'notes', label: 'Notes', type: 'string' },
];

/** Mount with the create tab open (the collapsed state renders only buttons). */
function openCreate() {
  const utils = render(
    <InlineCreateRelated
      objectName="Contact"
      relationshipField="account_id"
      fields={fields}
      onCreateRecord={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /New Contact/ }));
  return utils;
}

describe('InlineCreateRelated — `aria-required` reaches the input (objectui#3299)', () => {
  it('sets aria-required="true" on a required field input', () => {
    openCreate();

    expect(screen.getByPlaceholderText('Enter name')).toHaveAttribute('aria-required', 'true');
  });

  it('omits the attribute entirely on an optional field, rather than writing "false"', () => {
    openCreate();

    expect(screen.getByPlaceholderText('Enter notes')).not.toHaveAttribute('aria-required');
  });

  it('hides the asterisk from the a11y tree (visual-only marker)', () => {
    const { container } = openCreate();

    const marker = container.querySelector('label > span');
    expect(marker).not.toBeNull();
    expect(marker).toHaveTextContent('*');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
  });

  it('never sets the native `required` attribute (#3290: no double validation UI)', () => {
    openCreate();

    // NOT `toBeRequired()` — jest-dom counts `aria-required="true"` as
    // required, so it cannot distinguish the channel under test.
    const input = screen.getByPlaceholderText('Enter name') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).not.toHaveAttribute('required');
    expect(input.required).toBe(false);
  });
});
