/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * InlineCreateRelated — the create-tab `<label>` must be programmatically
 * associated with its `<Input>` (objectui#3341).
 *
 * Sibling-but-different-class defect to #3299: that one fixed "the required
 * STATE never reaches the a11y tree". This one is "the label and the control
 * were never connected at all" — pre-fix the `<label>` carried no `htmlFor`,
 * the `<Input>` no `id`, and they were siblings rather than wrapper/child. The
 * consequences were both machine-visible and user-visible:
 *
 *   - the label text never reached the input's accessible name, and
 *   - clicking the label did not focus the input.
 *
 * Measured pre-fix accessible name in this harness: the EMPTY string.
 * `dom-accessibility-api` implements no `placeholder` fallback (a real browser
 * would fall back to "Enter name" per HTML-AAM), so the observable failure
 * here is an unnamed control rather than a mis-named one. Either way the label
 * was not the name, which is what these tests pin.
 *
 * The ids are namespaced with `React.useId` because `field.name` alone is only
 * unique within ONE instance, and a detail page mounts one of these per related
 * list.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { InlineCreateRelated } from '../InlineCreateRelated';
import type { RelatedFieldDefinition } from '../InlineCreateRelated';

afterEach(cleanup);

const fields: RelatedFieldDefinition[] = [
  { name: 'name', label: 'Name', type: 'string', required: true },
  { name: 'notes', label: 'Notes', type: 'string' },
];

/** Mount with the create tab open (the collapsed state renders only buttons). */
function openCreate(objectName = 'Contact') {
  const utils = render(
    <InlineCreateRelated
      objectName={objectName}
      relationshipField="account_id"
      fields={fields}
      onCreateRecord={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`New ${objectName}`) }));
  return utils;
}

describe('InlineCreateRelated — label→control association (objectui#3341)', () => {
  it('resolves the label to the input, so getByLabelText finds the control', () => {
    openCreate();

    // `Notes` is the OPTIONAL field, so its label text is exactly "Notes".
    // (For a required field the label's textContent also contains the visual
    // `*`; RTL's label-text query reads raw textContent and — unlike the
    // accessible-name computation — does NOT honour `aria-hidden`. That is why
    // the exact-string case uses the optional field; the required field is
    // asserted below on the computed accessible name, where the `*` is
    // correctly excluded.)
    const notes = screen.getByLabelText('Notes');
    expect(notes.tagName).toBe('INPUT');
    expect(notes).toBe(screen.getByPlaceholderText('Enter notes'));
  });

  it('gives the input the LABEL as its accessible name', () => {
    openCreate();

    // Located by placeholder deliberately: that is the pre-fix identity of
    // these inputs, and it is independent of the association under test.
    // Pre-fix both of these computed to '' (see the file header).
    expect(screen.getByPlaceholderText('Enter name')).toHaveAccessibleName('Name');
    expect(screen.getByPlaceholderText('Enter notes')).toHaveAccessibleName('Notes');
  });

  it('keeps the visual `*` out of the required field\'s accessible name', () => {
    openCreate();

    // #3299 made the asterisk `aria-hidden`; now that the label actually feeds
    // the accessible name, that matters — otherwise this would read "Name *".
    const name = screen.getByPlaceholderText('Enter name');
    expect(name).toHaveAccessibleName('Name');
    expect(name).toHaveAttribute('aria-required', 'true');
  });

  it('points htmlFor at an id that really exists on the input', () => {
    const { container } = openCreate();

    const label = container.querySelector('label[for]');
    expect(label).not.toBeNull();
    const target = document.getElementById(label!.getAttribute('for')!);
    expect(target).not.toBeNull();
    expect(target!.tagName).toBe('INPUT');
  });

  it('mints per-instance ids so two related lists on one page do not collide', () => {
    // The regression this guards: ids derived from `field.name` alone would be
    // identical across instances, and every `<label for="name">` on the page
    // would resolve to the FIRST input — clicking the second list's label would
    // focus the first list's box.
    render(
      <div>
        <div data-testid="list-contact">
          <InlineCreateRelated
            objectName="Contact"
            relationshipField="account_id"
            fields={fields}
            onCreateRecord={vi.fn()}
          />
        </div>
        <div data-testid="list-task">
          <InlineCreateRelated
            objectName="Task"
            relationshipField="account_id"
            fields={fields}
            onCreateRecord={vi.fn()}
          />
        </div>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /New Contact/ }));
    fireEvent.click(screen.getByRole('button', { name: /New Task/ }));

    const inputs = screen.getAllByLabelText('Notes');
    expect(inputs).toHaveLength(2);
    const ids = inputs.map((el) => el.id);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);

    // …and each list's label resolves to the input inside its OWN subtree,
    // which is precisely what a shared `id="notes"` would have broken.
    const contact = within(screen.getByTestId('list-contact')).getByLabelText('Notes');
    const task = within(screen.getByTestId('list-task')).getByLabelText('Notes');
    expect(contact).not.toBe(task);
    expect(new Set([contact.id, task.id]).size).toBe(2);
  });

  it('registers the label on the input via the DOM `labels` collection', () => {
    // The association browsers use for BOTH the accessible name and
    // click-to-focus. Asserted structurally rather than by clicking the label:
    // jsdom forwards a label click to the control's activation behaviour but
    // does not move focus, so a `toHaveFocus()` assertion here would be
    // testing jsdom, not this component.
    openCreate();

    const notes = screen.getByLabelText('Notes') as HTMLInputElement;
    expect(notes.labels).not.toBeNull();
    expect(Array.from(notes.labels!)).toHaveLength(1);
    expect(notes.labels![0].getAttribute('for')).toBe(notes.id);
    expect(notes.labels![0]).toHaveTextContent('Notes');
  });
});
