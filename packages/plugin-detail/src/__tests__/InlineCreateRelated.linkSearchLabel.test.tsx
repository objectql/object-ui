/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * InlineCreateRelated — the LINK tab's search box needs a real accessible name
 * (objectui#3381).
 *
 * Third of the family, and a different class from both predecessors:
 *   - #3299 — the required STATE never reached the a11y tree;
 *   - #3341 — a label EXISTED but was never associated with its control;
 *   - this one — the search box had NO label of any kind (no `<label>`, no
 *     `aria-label`, no `aria-labelledby`), so its accessible name fell through
 *     to the placeholder.
 *
 * Why placeholder-as-name is the bug and not merely a style nit:
 *   - it is the LAST resort in HTML-AAM, and the visible hint it names is gone
 *     the moment the user types the first character;
 *   - the fallback is not implemented uniformly. `dom-accessibility-api` (what
 *     jest-dom's `toHaveAccessibleName` computes with) has no placeholder step
 *     at all, so pre-fix this control computed to the EMPTY string here while a
 *     real browser would have said "Search Contact…".
 *
 * Both halves are pinned below: the name must be the label, and — the split
 * between a real label and a placeholder standing in for one — it must survive
 * the user typing. The label text is deliberately `Search Contact` while the
 * placeholder is `Search Contact…`; the trailing ellipsis makes the two
 * distinguishable, so "the name is not just the placeholder read back" is
 * assertable in EITHER implementation, including one that does fall back.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { InlineCreateRelated } from '../InlineCreateRelated';

afterEach(cleanup);

const records = [
  { id: '1', label: 'Northwind Traders', description: 'Customer' },
  { id: '2', label: 'Contoso Ltd', description: 'Partner' },
];

/** Mount and open the link tab (the collapsed state renders only buttons). */
function openLink(objectName = 'Contact') {
  const utils = render(
    <InlineCreateRelated
      objectName={objectName}
      relationshipField="account_id"
      fields={[{ name: 'name', label: 'Name', type: 'string' }]}
      onCreateRecord={vi.fn()}
      onLinkRecord={vi.fn()}
      existingRecords={records}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Link Existing/ }));
  return utils;
}

describe('InlineCreateRelated — link-tab search box accessible name (objectui#3381)', () => {
  it('resolves a label to the search input, so getByLabelText finds the control', () => {
    openLink();

    const search = screen.getByLabelText('Search Contact');
    expect(search.tagName).toBe('INPUT');
    // Located independently by the pre-fix identity of this box — its
    // placeholder — to prove both queries land on the same element.
    expect(search).toBe(screen.getByPlaceholderText('Search Contact…'));
  });

  it('gives the search input the LABEL as its accessible name', () => {
    openLink();

    // Pre-fix this computed to '' in this harness (see the file header).
    const search = screen.getByPlaceholderText('Search Contact…');
    expect(search).toHaveAccessibleName('Search Contact');
  });

  it('keeps the accessible name AFTER the user types, when the placeholder is gone', () => {
    // The dividing line between a real label and placeholder-as-label: a
    // browser stops showing the placeholder at the first keystroke, so a name
    // sourced from it is a name that disappears exactly when the user is
    // deepest in the interaction.
    openLink();

    const search = screen.getByPlaceholderText('Search Contact…') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'North' } });

    expect(search.value).toBe('North');
    expect(search).toHaveAccessibleName('Search Contact');
    // …and the box is live, i.e. this is the real search control, not a
    // look-alike: the non-matching record is filtered out.
    expect(screen.getByText('Northwind Traders')).toBeInTheDocument();
    expect(screen.queryByText('Contoso Ltd')).not.toBeInTheDocument();
  });

  it('does not source the name from the placeholder', () => {
    // Implementation-independent form of the assertion above: even where the
    // placeholder fallback DOES exist (real browsers), the computed name must
    // not be the placeholder string.
    openLink();

    const search = screen.getByLabelText('Search Contact');
    expect(search.getAttribute('placeholder')).toBe('Search Contact…');
    expect(search).not.toHaveAccessibleName('Search Contact…');
  });

  it('tracks objectName in both the label and the placeholder', () => {
    // Both strings come off one expression; this pins that they stay in sync.
    openLink('Opportunity');

    const search = screen.getByLabelText('Search Opportunity');
    expect(search).toHaveAttribute('placeholder', 'Search Opportunity…');
    expect(search).toHaveAccessibleName('Search Opportunity');
  });

  it('registers the label on the input via the DOM `labels` collection', () => {
    // The association a browser uses for BOTH the accessible name and
    // click-to-focus — asserted structurally, as in the #3341 suite (jsdom /
    // happy-dom do not move focus on a label click).
    openLink();

    const search = screen.getByLabelText('Search Contact') as HTMLInputElement;
    expect(search.labels).not.toBeNull();
    expect(Array.from(search.labels!)).toHaveLength(1);
    expect(search.labels![0].getAttribute('for')).toBe(search.id);
    expect(search.labels![0]).toHaveTextContent('Search Contact');
  });

  it('mints a per-instance id so two related lists on one page do not collide', () => {
    // Same regression #3341 guarded for the create tab: a constant id would
    // make every `<label for>` on the page resolve to the FIRST search box.
    render(
      <div>
        <div data-testid="list-a">
          <InlineCreateRelated
            objectName="Contact"
            relationshipField="account_id"
            fields={[]}
            onLinkRecord={vi.fn()}
            existingRecords={records}
          />
        </div>
        <div data-testid="list-b">
          <InlineCreateRelated
            objectName="Contact"
            relationshipField="opportunity_id"
            fields={[]}
            onLinkRecord={vi.fn()}
            existingRecords={records}
          />
        </div>
      </div>,
    );
    const [triggerA, triggerB] = screen.getAllByRole('button', { name: /Link Existing/ });
    fireEvent.click(triggerA);
    fireEvent.click(triggerB);

    const boxes = screen.getAllByLabelText('Search Contact');
    expect(boxes).toHaveLength(2);
    expect(boxes[0].id).toBeTruthy();
    expect(boxes[1].id).toBeTruthy();
    expect(boxes[0].id).not.toBe(boxes[1].id);

    const a = within(screen.getByTestId('list-a')).getByLabelText('Search Contact');
    const b = within(screen.getByTestId('list-b')).getByLabelText('Search Contact');
    expect(a).not.toBe(b);
  });

  it('does not collide with a create-tab field literally named "search"', () => {
    // `fieldDomId` suffixes the instance id with the metadata field name, so a
    // field called `search` lands on `…-search`. The search box uses the
    // hyphenated `link-search` segment for exactly this reason — the two ids
    // are minted from the same instance id and must still differ.
    render(
      <InlineCreateRelated
        objectName="Contact"
        relationshipField="account_id"
        fields={[{ name: 'search', label: 'Search term', type: 'string' }]}
        onCreateRecord={vi.fn()}
        onLinkRecord={vi.fn()}
        existingRecords={records}
      />,
    );
    // Read the create-tab id first: Radix unmounts the inactive tab's content,
    // so the two inputs are never in the DOM at the same moment.
    fireEvent.click(screen.getByRole('button', { name: /New Contact/ }));
    const fieldId = screen.getByLabelText('Search term').id;
    // Radix activates a tab on mousedown, not click (@radix-ui/react-tabs
    // 1.1.x) — a bare `click` leaves the create tab selected.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Link Existing/ }), { button: 0 });
    const searchId = screen.getByLabelText('Search Contact').id;

    expect(fieldId).toBeTruthy();
    expect(searchId).toBeTruthy();
    expect(searchId).not.toBe(fieldId);
  });

  it('leaves the decorative magnifier out of the a11y tree', () => {
    openLink();

    // Scoped to the search box's own wrapper — the card renders other icons
    // (close, tab triggers) that this test is not about.
    const search = screen.getByLabelText('Search Contact');
    const icon = search.closest('div')!.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
